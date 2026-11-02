CREATE TABLE public.utkal_platform_payment_settings (
 store_id uuid PRIMARY KEY REFERENCES public.stores(id),
 enabled boolean NOT NULL DEFAULT false,
 environment text NOT NULL DEFAULT 'sandbox' CHECK(environment IN ('sandbox','production')),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT utkal_platform_only CHECK(store_id = 'ab19143d-87a9-490e-90b7-837313522782'::uuid)
);
GRANT ALL ON public.utkal_platform_payment_settings TO service_role;
ALTER TABLE public.utkal_platform_payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY utkal_platform_settings_service ON public.utkal_platform_payment_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE public.utkal_platform_payment_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id),
 order_id uuid NOT NULL REFERENCES public.orders(id),
 token_hash text NOT NULL UNIQUE,
 provider_order_id text NOT NULL UNIQUE,
 provider_payment_id text UNIQUE,
 environment text NOT NULL CHECK(environment IN ('sandbox','production')),
 amount_minor bigint NOT NULL CHECK(amount_minor > 0),
 total_minor bigint NOT NULL CHECK(total_minor >= amount_minor),
 currency text NOT NULL DEFAULT 'INR' CHECK(currency='INR'),
 payment_type text NOT NULL CHECK(payment_type IN ('full','partial')),
 state text NOT NULL DEFAULT 'reserved' CHECK(state IN ('reserved','ready','paid','review')),
 payment_session_id text,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 verified_at timestamptz,
 CONSTRAINT utkal_platform_attempt_only CHECK(store_id = 'ab19143d-87a9-490e-90b7-837313522782'::uuid)
);
GRANT ALL ON public.utkal_platform_payment_attempts TO service_role;
ALTER TABLE public.utkal_platform_payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY utkal_platform_attempts_service ON public.utkal_platform_payment_attempts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE UNIQUE INDEX utkal_platform_one_open_attempt ON public.utkal_platform_payment_attempts(order_id) WHERE state IN ('reserved','ready');

CREATE FUNCTION public.reserve_utkal_platform_payment(p_order_id uuid, p_checkout_token text, p_token_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.orders%ROWTYPE; cfg public.utkal_platform_payment_settings%ROWTYPE; a public.utkal_platform_payment_attempts%ROWTYPE; charge bigint; total_value bigint;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.store_id <> 'ab19143d-87a9-490e-90b7-837313522782'::uuid OR o.checkout_token IS DISTINCT FROM p_checkout_token OR p_checkout_token IS NULL OR length(p_checkout_token)<8 THEN RAISE EXCEPTION 'Invalid checkout capability'; END IF;
 SELECT * INTO cfg FROM public.utkal_platform_payment_settings WHERE store_id=o.store_id;
 IF NOT FOUND OR NOT cfg.enabled THEN RAISE EXCEPTION 'Feature disabled'; END IF;
 IF o.status <> 'pending' OR COALESCE(o.payment_verified,false) THEN RAISE EXCEPTION 'Order is not payable'; END IF;
 IF o.currency <> 'INR' OR o.payment_type NOT IN ('partial','full') THEN RAISE EXCEPTION 'Invalid payment selection'; END IF;
 total_value := round(o.total * 100); charge := CASE WHEN o.payment_type='partial' THEN round(o.advance_paid * 100) ELSE total_value END;
 IF charge IS NULL OR charge<=0 OR charge>total_value THEN RAISE EXCEPTION 'Invalid payment amount'; END IF;
 SELECT * INTO a FROM public.utkal_platform_payment_attempts WHERE order_id=o.id AND state IN ('reserved','ready') FOR UPDATE;
 IF FOUND THEN
  IF a.amount_minor<>charge OR a.total_minor<>total_value OR a.payment_type<>o.payment_type THEN RAISE EXCEPTION 'Existing payment must be resolved before changing amount'; END IF;
  UPDATE public.utkal_platform_payment_attempts SET token_hash=p_token_hash, expires_at=now()+interval '30 minutes' WHERE id=a.id RETURNING * INTO a;
 ELSE
  INSERT INTO public.utkal_platform_payment_attempts(store_id,order_id,token_hash,provider_order_id,environment,amount_minor,total_minor,currency,payment_type,expires_at)
  VALUES(o.store_id,o.id,p_token_hash,'utkal_'||replace(gen_random_uuid()::text,'-',''),cfg.environment,charge,total_value,'INR',o.payment_type,now()+interval '30 minutes') RETURNING * INTO a;
 END IF;
 RETURN to_jsonb(a);
END $$;
REVOKE ALL ON FUNCTION public.reserve_utkal_platform_payment(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_utkal_platform_payment(uuid,text,text) TO service_role;

CREATE FUNCTION public.finalize_utkal_platform_payment(p_attempt_id uuid, p_payment_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.utkal_platform_payment_attempts%ROWTYPE; o public.orders%ROWTYPE; charge bigint;
BEGIN
 SELECT * INTO a FROM public.utkal_platform_payment_attempts WHERE id=p_attempt_id FOR UPDATE;
 IF NOT FOUND OR p_payment_id IS NULL OR length(p_payment_id)=0 THEN RAISE EXCEPTION 'Invalid attempt'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=a.order_id FOR UPDATE;
 IF a.state='paid' THEN RETURN jsonb_build_object('paid',true,'order_id',o.id,'status',o.status); END IF;
 charge := CASE WHEN o.payment_type='partial' THEN round(o.advance_paid*100) ELSE round(o.total*100) END;
 IF o.store_id<>a.store_id OR charge<>a.amount_minor OR round(o.total*100)<>a.total_minor OR o.currency<>a.currency OR o.payment_type<>a.payment_type OR o.status NOT IN ('pending','cancelled') OR COALESCE(o.payment_verified,false) THEN
  UPDATE public.utkal_platform_payment_attempts SET state='review',provider_payment_id=p_payment_id,verified_at=now() WHERE id=a.id;
  RETURN jsonb_build_object('paid',false,'review',true);
 END IF;
 UPDATE public.utkal_platform_payment_attempts SET state='paid',provider_payment_id=p_payment_id,verified_at=now() WHERE id=a.id;
 UPDATE public.orders SET status=CASE WHEN a.payment_type='partial' THEN 'partially_paid' ELSE 'confirmed' END, payment_method='cashfree',payment_verified=true,payment_verified_at=now(), notes=COALESCE(notes,'')||E'\nShopBanao Cashfree payment verified' WHERE id=o.id;
 UPDATE public.abandoned_carts SET recovered=true WHERE store_id=o.store_id AND session_token=o.checkout_token;
 RETURN jsonb_build_object('paid',true,'order_id',o.id,'status',CASE WHEN a.payment_type='partial' THEN 'partially_paid' ELSE 'confirmed' END);
END $$;
REVOKE ALL ON FUNCTION public.finalize_utkal_platform_payment(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_utkal_platform_payment(uuid,text) TO service_role;
COMMENT ON TABLE public.utkal_platform_payment_settings IS 'Utkal-only platform checkout; no row or enabled=false means disabled. Do not activate until owner requests testing.';