
-- 1) Global opt-out: allow one row per phone with store_id NULL (platform-wide block).
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_optouts_global_phone_uq
  ON public.whatsapp_optouts(phone) WHERE store_id IS NULL;

-- 2) Link tracking
CREATE TABLE IF NOT EXISTS public.wa_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  campaign_id uuid,
  recipient_phone text,
  target_url text NOT NULL,
  user_agent text,
  ip_hash text,
  clicked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.wa_link_clicks TO authenticated;
GRANT ALL ON public.wa_link_clicks TO service_role;
ALTER TABLE public.wa_link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads wa_link_clicks" ON public.wa_link_clicks
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS wa_link_clicks_short_id_idx ON public.wa_link_clicks(short_id);
CREATE INDEX IF NOT EXISTS wa_link_clicks_phone_idx ON public.wa_link_clicks(recipient_phone, clicked_at DESC);

-- 3) Health log (one row per cron snapshot)
CREATE TABLE IF NOT EXISTS public.wa_health_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  phone_number_id text,
  quality_rating text,        -- GREEN / YELLOW / RED / UNKNOWN
  messaging_limit_tier text,  -- TIER_50/TIER_250/TIER_1K/...
  name_status text,
  token_expires_at timestamptz,
  token_valid boolean,
  raw jsonb,
  alert_sent boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.wa_health_log TO authenticated;
GRANT ALL ON public.wa_health_log TO service_role;
ALTER TABLE public.wa_health_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads wa_health_log" ON public.wa_health_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS wa_health_log_at_idx ON public.wa_health_log(checked_at DESC);

-- 4) Meta sync columns on templates
ALTER TABLE public.platform_wa_templates
  ADD COLUMN IF NOT EXISTS meta_status text,
  ADD COLUMN IF NOT EXISTS meta_template_id text,
  ADD COLUMN IF NOT EXISTS quality_score text,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- 5) Inbox routing helper column
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS inferred_store_id uuid REFERENCES public.stores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thread_read_at timestamptz;

CREATE INDEX IF NOT EXISTS whatsapp_messages_recipient_idx
  ON public.whatsapp_messages(recipient_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_sender_idx
  ON public.whatsapp_messages(sender_phone, created_at DESC);

-- 6) Helper: find last store a phone interacted with (outbound from shared number)
CREATE OR REPLACE FUNCTION public.wa_resolve_inbound_store(_phone text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM public.whatsapp_messages
   WHERE recipient_phone = _phone
     AND direction = 'outgoing'
     AND store_id IS NOT NULL
   ORDER BY created_at DESC LIMIT 1
$$;

-- 7) Trigger: order status updates → WA queue (shipped / delivered / cancelled)
CREATE OR REPLACE FUNCTION public.wa_enqueue_order_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_event text;
  v_template text;
  v_phone text;
  v_store_settings record;
  v_store record;
  v_base text;
  v_order_link text;
  v_tracking_url text;
  v_order_num text;
  v_total text;
BEGIN
  -- Only fire when status changes
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  IF NEW.status = 'shipped' THEN v_event := 'order_shipped'; v_template := 'order_shipped_v1';
  ELSIF NEW.status = 'delivered' THEN v_event := 'order_delivered'; v_template := 'order_delivered_v1';
  ELSIF NEW.status = 'cancelled' THEN v_event := 'order_cancelled'; v_template := 'order_cancelled_v1';
  ELSE RETURN NEW;
  END IF;

  v_phone := regexp_replace(coalesce(NEW.customer_phone,''), '[^0-9]', '', 'g');
  IF length(v_phone) < 8 THEN RETURN NEW; END IF;

  SELECT * INTO v_store_settings FROM public.stores_wa_settings WHERE store_id = NEW.store_id;
  IF v_store_settings.platform_marketing_enabled IS FALSE THEN RETURN NEW; END IF;

  SELECT name, slug, custom_domain INTO v_store FROM public.stores WHERE id = NEW.store_id;
  v_base := CASE WHEN v_store.custom_domain IS NOT NULL THEN 'https://' || v_store.custom_domain
                 WHEN v_store.slug IS NOT NULL THEN 'https://' || v_store.slug || '.shopbanao.in'
                 ELSE 'https://shopbanao.in' END;
  v_order_link := v_base || '/account/orders/' || NEW.id::text;
  v_tracking_url := coalesce(NEW.tracking_url, v_order_link);
  v_order_num := coalesce(NEW.order_number, upper(substring(NEW.id::text, 1, 8)));
  v_total := '₹' || to_char(coalesce(NEW.total,0), 'FM999999990');

  INSERT INTO public.wa_send_queue (
    store_id, recipient_phone, recipient_name, template_name, message_type,
    order_id, params, template_vars, priority, scheduled_at
  ) VALUES (
    NEW.store_id, v_phone, coalesce(NEW.customer_name,'there'), v_template, v_event,
    NEW.id, '[]'::jsonb,
    jsonb_build_object(
      'customer_name', coalesce(NEW.customer_name,'there'),
      'order_number', v_order_num,
      'order_total', v_total,
      'order_link', v_order_link,
      'tracking_url', v_tracking_url
    ),
    2, now()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block order updates because of WA queue
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wa_order_status ON public.orders;
CREATE TRIGGER trg_wa_order_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.wa_enqueue_order_event();

-- 8) Trigger: new storefront customer signup → welcome message
CREATE OR REPLACE FUNCTION public.wa_enqueue_welcome()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text;
  v_store record;
  v_base text;
BEGIN
  v_phone := regexp_replace(coalesce(NEW.phone,''), '[^0-9]', '', 'g');
  IF length(v_phone) < 8 THEN RETURN NEW; END IF;

  SELECT name, slug, custom_domain INTO v_store FROM public.stores WHERE id = NEW.store_id;
  v_base := CASE WHEN v_store.custom_domain IS NOT NULL THEN 'https://' || v_store.custom_domain
                 WHEN v_store.slug IS NOT NULL THEN 'https://' || v_store.slug || '.shopbanao.in'
                 ELSE 'https://shopbanao.in' END;

  INSERT INTO public.wa_send_queue (
    store_id, recipient_phone, recipient_name, template_name, message_type,
    params, template_vars, priority, scheduled_at
  ) VALUES (
    NEW.store_id, v_phone, coalesce(NEW.name,'there'), 'welcome_v1', 'welcome',
    '[]'::jsonb,
    jsonb_build_object(
      'customer_name', coalesce(NEW.name,'there'),
      'store_name', coalesce(v_store.name,'our store'),
      'shop_url', v_base
    ),
    4, now() + interval '2 minutes'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_wa_welcome ON public.storefront_customers;
CREATE TRIGGER trg_wa_welcome
  AFTER INSERT ON public.storefront_customers
  FOR EACH ROW EXECUTE FUNCTION public.wa_enqueue_welcome();

-- 9) Admin helper RPCs
CREATE OR REPLACE FUNCTION public.admin_wa_requeue_failed(_since timestamptz DEFAULT now() - interval '24 hours', _template text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.wa_send_queue
     SET status='pending', attempts=0, scheduled_at=now(), last_error=NULL, last_error_class=NULL, locked_until=NULL
   WHERE status='failed' AND created_at >= _since
     AND (_template IS NULL OR template_name = _template);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.admin_wa_purge_marketing()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.wa_send_queue
     SET status='skipped', last_error='admin_purge_marketing', locked_until=NULL
   WHERE status='pending'
     AND message_type NOT IN ('order_confirmation','payment_success','payment_received','order_shipped','order_delivered','order_cancelled');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.admin_wa_mark_thread_read(_phone text, _store_id uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.whatsapp_messages
     SET thread_read_at = now()
   WHERE direction='incoming' AND status='received'
     AND (sender_phone = _phone OR recipient_phone = _phone)
     AND (_store_id IS NULL OR store_id = _store_id OR inferred_store_id = _store_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.whatsapp_messages SET status='read' WHERE thread_read_at IS NOT NULL AND status='received';
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.admin_wa_health_snapshot()
RETURNS TABLE (
  checked_at timestamptz, quality_rating text, messaging_limit_tier text,
  name_status text, token_valid boolean, token_expires_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT checked_at, quality_rating, messaging_limit_tier, name_status, token_valid, token_expires_at
    FROM public.wa_health_log ORDER BY checked_at DESC LIMIT 1
$$;
