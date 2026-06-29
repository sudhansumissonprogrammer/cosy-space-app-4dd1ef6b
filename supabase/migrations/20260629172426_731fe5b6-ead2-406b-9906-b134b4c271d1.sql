
-- P0/P1 hardening for shared WhatsApp platform

-- ============ P0.1: 24h conversation window tracker ============
CREATE TABLE IF NOT EXISTS public.wa_active_conversations (
  recipient_phone text NOT NULL,
  category text NOT NULL CHECK (category IN ('marketing','utility','authentication','service')),
  opened_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_conversation_id text,
  cost numeric(10,4) DEFAULT 0,
  PRIMARY KEY (recipient_phone, category)
);
GRANT SELECT ON public.wa_active_conversations TO authenticated;
GRANT ALL ON public.wa_active_conversations TO service_role;
ALTER TABLE public.wa_active_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin reads active conversations" ON public.wa_active_conversations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS wa_active_conv_expires ON public.wa_active_conversations(expires_at);

-- Estimate cost for a campaign audience (counts those WITHOUT an open marketing window).
CREATE OR REPLACE FUNCTION public.wa_estimate_campaign_cost(_phones text[], _category text DEFAULT 'marketing')
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_total int := coalesce(array_length(_phones,1), 0);
  v_open int;
  v_rate numeric;
BEGIN
  IF v_total = 0 THEN
    RETURN jsonb_build_object('total',0,'billable',0,'cost',0,'currency','INR');
  END IF;
  SELECT count(*) INTO v_open FROM public.wa_active_conversations
    WHERE recipient_phone = ANY(_phones) AND category = _category AND expires_at > now();
  v_rate := CASE lower(_category)
    WHEN 'marketing' THEN 0.7846
    WHEN 'utility' THEN 0.115
    WHEN 'authentication' THEN 0.115
    ELSE 0 END;
  RETURN jsonb_build_object(
    'total', v_total,
    'open_window', v_open,
    'billable', v_total - v_open,
    'cost', round((v_total - v_open) * v_rate, 2),
    'currency', 'INR'
  );
END $$;
GRANT EXECUTE ON FUNCTION public.wa_estimate_campaign_cost(text[], text) TO authenticated;

-- ============ P0.2: Quality rating + tier auto-throttle ============
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS wa_quality_rating text DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS wa_messaging_tier text DEFAULT 'TIER_NOT_SET',
  ADD COLUMN IF NOT EXISTS wa_throttle_marketing boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_quality_updated_at timestamptz;

-- ============ P0.3: Template pause flag enforced at enqueue ============
ALTER TABLE public.platform_wa_templates
  ADD COLUMN IF NOT EXISTS paused boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS pause_reason text;

-- ============ P0.4: Strict phone validation in enqueue trigger ============
CREATE OR REPLACE FUNCTION public.wa_enqueue_order_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_enabled boolean;
  v_phone text;
  v_store_settings record;
  v_store record;
  v_base text;
  v_order_link text;
  v_tracking_url text;
  v_tracking_no text;
  v_order_num text;
  v_total text;
  v_exists boolean;
  v_paused boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT wa_enabled INTO v_enabled FROM public.platform_config LIMIT 1;
  IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;
  IF NEW.status <> 'shipped' THEN RETURN NEW; END IF;
  IF NEW.tracking_number IS NULL OR length(trim(NEW.tracking_number)) = 0 THEN RETURN NEW; END IF;

  -- Block if template is paused
  SELECT paused INTO v_paused FROM public.platform_wa_templates WHERE name = 'order_shipped_v1';
  IF v_paused IS TRUE THEN RETURN NEW; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.wa_send_queue
    WHERE order_id = NEW.id AND message_type = 'order_shipped'
      AND status IN ('pending','sending','sent','skipped')
  ) INTO v_exists;
  IF v_exists THEN RETURN NEW; END IF;

  -- Normalize + validate Indian E.164 (91 + 10-digit mobile starting 6-9)
  v_phone := regexp_replace(coalesce(NEW.customer_phone,''), '[^0-9]', '', 'g');
  IF length(v_phone) = 10 AND v_phone ~ '^[6-9]' THEN v_phone := '91' || v_phone; END IF;
  IF v_phone !~ '^91[6-9][0-9]{9}$' THEN RETURN NEW; END IF;

  SELECT * INTO v_store_settings FROM public.stores_wa_settings WHERE store_id = NEW.store_id;
  IF v_store_settings.platform_marketing_enabled IS FALSE THEN RETURN NEW; END IF;

  SELECT name, slug, custom_domain INTO v_store FROM public.stores WHERE id = NEW.store_id;
  v_base := CASE WHEN v_store.custom_domain IS NOT NULL THEN 'https://' || v_store.custom_domain
                 WHEN v_store.slug IS NOT NULL THEN 'https://' || v_store.slug || '.shopbanao.in'
                 ELSE 'https://shopbanao.in' END;
  v_order_link := v_base || '/account/orders/' || NEW.id::text;
  v_tracking_url := coalesce(NEW.tracking_url, v_order_link);
  v_tracking_no := coalesce(NEW.tracking_number, '');
  v_order_num := coalesce(NEW.order_number, upper(substring(NEW.id::text, 1, 8)));
  v_total := '₹' || to_char(coalesce(NEW.total,0), 'FM999999990');

  INSERT INTO public.wa_send_queue (
    store_id, recipient_phone, recipient_name, template_name, message_type,
    order_id, params, template_vars, priority, scheduled_at
  ) VALUES (
    NEW.store_id, v_phone, coalesce(NEW.customer_name,'there'),
    'order_shipped_v1', 'order_shipped',
    NEW.id, '[]'::jsonb,
    jsonb_build_object(
      'customer_name', coalesce(NEW.customer_name,'there'),
      'order_number', v_order_num,
      'order_total', v_total,
      'order_link', v_order_link,
      'tracking_url', v_tracking_url,
      'tracking_number', v_tracking_no
    ),
    2, now()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $$;

-- ============ P1.7: Per-phone marketing cooldown ============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS last_marketing_sent_at timestamptz;
CREATE INDEX IF NOT EXISTS customers_phone_idx ON public.customers(phone);

-- ============ P1.8: Webhook event replay RPC ============
CREATE OR REPLACE FUNCTION public.wa_replay_webhook_event(_event_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row record;
BEGIN
  SELECT * INTO v_row FROM public.webhook_events WHERE event_id = _event_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  DELETE FROM public.webhook_events WHERE event_id = _event_id;
  RETURN jsonb_build_object('ok', true, 'cleared', _event_id);
END $$;
REVOKE ALL ON FUNCTION public.wa_replay_webhook_event(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wa_replay_webhook_event(text) TO authenticated;
