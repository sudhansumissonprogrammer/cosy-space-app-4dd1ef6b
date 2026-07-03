
-- Canonical 10-digit Indian mobile normalizer (mirrors src/lib/phoneUtils.ts)
CREATE OR REPLACE FUNCTION public.canonical_in_phone(p_raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d text;
BEGIN
  IF p_raw IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(p_raw, '\D', '', 'g');
  IF d IS NULL OR d = '' THEN RETURN NULL; END IF;
  IF length(d) = 13 AND left(d, 3) = '091' THEN d := substring(d from 4); END IF;
  IF length(d) = 12 AND left(d, 2) = '91'  THEN d := substring(d from 3); END IF;
  IF length(d) = 11 AND left(d, 1) = '0'   THEN d := substring(d from 2); END IF;
  IF length(d) = 10 AND d ~ '^[6-9]' THEN RETURN d; END IF;
  RETURN NULL;
END;
$$;

-- Step-1 checkout capture: upserts BOTH customer_leads and abandoned_carts.
-- SECURITY DEFINER so anonymous shoppers can call it without table grants.
CREATE OR REPLACE FUNCTION public.capture_checkout_lead(
  p_store_id      uuid,
  p_phone         text,
  p_cart_items    jsonb DEFAULT '[]'::jsonb,
  p_consent       boolean DEFAULT true,
  p_session_token text DEFAULT NULL,
  p_source        text DEFAULT 'checkout_step1'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := public.canonical_in_phone(p_phone);
  v_cart_id uuid;
  v_lead_id uuid;
  v_store_active boolean;
BEGIN
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_phone');
  END IF;
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store');
  END IF;

  SELECT (is_active IS DISTINCT FROM false) INTO v_store_active
  FROM public.stores WHERE id = p_store_id;
  IF NOT COALESCE(v_store_active, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_found');
  END IF;

  -- 1) Lead (append-only, dedupe within 24h per store+phone+source)
  IF NOT EXISTS (
    SELECT 1 FROM public.customer_leads
    WHERE store_id = p_store_id
      AND phone    = v_phone
      AND source   = p_source
      AND created_at > now() - interval '24 hours'
  ) THEN
    INSERT INTO public.customer_leads (store_id, phone, source)
    VALUES (p_store_id, v_phone, p_source)
    RETURNING id INTO v_lead_id;
  END IF;

  -- 2) Abandoned cart (upsert by store+phone+session; reset recovery so cron re-attempts)
  SELECT id INTO v_cart_id
  FROM public.abandoned_carts
  WHERE store_id = p_store_id
    AND customer_phone = v_phone
    AND (session_token IS NOT DISTINCT FROM p_session_token)
    AND recovered = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cart_id IS NULL THEN
    INSERT INTO public.abandoned_carts (
      store_id, customer_phone, cart_items, session_token,
      wa_marketing_consent, recovered
    ) VALUES (
      p_store_id, v_phone, COALESCE(p_cart_items, '[]'::jsonb), p_session_token,
      COALESCE(p_consent, true), false
    )
    RETURNING id INTO v_cart_id;
  ELSE
    UPDATE public.abandoned_carts
       SET cart_items          = COALESCE(p_cart_items, cart_items),
           wa_marketing_consent = COALESCE(p_consent, wa_marketing_consent),
           recovery_sent_at    = NULL,
           recovery_status     = NULL,
           recovery_error      = NULL
     WHERE id = v_cart_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'phone', v_phone,
    'cart_id', v_cart_id,
    'lead_id', v_lead_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.capture_checkout_lead(uuid, text, jsonb, boolean, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.canonical_in_phone(text) TO anon, authenticated, service_role;
