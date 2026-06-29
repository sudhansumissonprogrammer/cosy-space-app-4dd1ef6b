
-- 1) Add tier limit column
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS wa_tier_limit integer NOT NULL DEFAULT 250;

-- 2) Harden order-event trigger: shipped requires tracking_number; pass tracking_number to template_vars
CREATE OR REPLACE FUNCTION public.wa_enqueue_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean;
  v_event text;
  v_template text;
  v_phone text;
  v_store_settings record;
  v_store record;
  v_base text;
  v_order_link text;
  v_tracking_url text;
  v_tracking_no text;
  v_order_num text;
  v_total text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT wa_enabled INTO v_enabled FROM public.platform_config LIMIT 1;
  IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

  IF NEW.status = 'shipped' THEN
    -- Do not send a "shipped" WhatsApp message until tracking number is present.
    IF NEW.tracking_number IS NULL OR length(trim(NEW.tracking_number)) = 0 THEN
      RETURN NEW;
    END IF;
    v_event := 'order_shipped'; v_template := 'order_shipped_v1';
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
  v_tracking_no := coalesce(NEW.tracking_number, '');
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
      'tracking_url', v_tracking_url,
      'tracking_number', v_tracking_no
    ),
    2, now()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $function$;

-- 3) Update admin RPCs to read/write wa_tier_limit
CREATE OR REPLACE FUNCTION public.admin_get_platform_wa_config()
 RETURNS jsonb
 LANGUAGE plpgsql STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.platform_config LIMIT 1;
  RETURN jsonb_build_object(
    'whatsapp_mode', r.whatsapp_mode,
    'wa_enabled', r.wa_enabled,
    'wa_phone_number_id', r.wa_phone_number_id,
    'wa_business_phone', r.wa_business_phone,
    'wa_waba_id', r.wa_waba_id,
    'wa_default_lang', r.wa_default_lang,
    'wa_min_cart_age_minutes', r.wa_min_cart_age_minutes,
    'wa_max_cart_age_hours', r.wa_max_cart_age_hours,
    'wa_daily_cap_per_phone', r.wa_daily_cap_per_phone,
    'wa_tier_limit', r.wa_tier_limit,
    'wa_access_token_present', (r.wa_access_token IS NOT NULL AND length(r.wa_access_token) > 0),
    'wa_app_secret_present', (r.wa_app_secret IS NOT NULL AND length(r.wa_app_secret) > 0),
    'wa_queue_batch_size', r.wa_queue_batch_size,
    'wa_pilot_mode', r.wa_pilot_mode,
    'wa_pilot_cohort', COALESCE(to_jsonb(r.wa_pilot_cohort), '[]'::jsonb)
  );
END $function$;

CREATE OR REPLACE FUNCTION public.admin_update_platform_wa_config(_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pid uuid;
  cohort uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO pid FROM public.platform_config LIMIT 1;

  IF _patch ? 'wa_pilot_cohort' THEN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[])
      INTO cohort
      FROM jsonb_array_elements_text(_patch->'wa_pilot_cohort') AS value
      WHERE length(value) > 0;
  END IF;

  UPDATE public.platform_config SET
    whatsapp_mode = COALESCE(_patch->>'whatsapp_mode', whatsapp_mode),
    wa_enabled = COALESCE((_patch->>'wa_enabled')::boolean, wa_enabled),
    wa_phone_number_id = COALESCE(NULLIF(_patch->>'wa_phone_number_id',''), wa_phone_number_id),
    wa_business_phone = COALESCE(NULLIF(_patch->>'wa_business_phone',''), wa_business_phone),
    wa_waba_id = COALESCE(NULLIF(_patch->>'wa_waba_id',''), wa_waba_id),
    wa_access_token = COALESCE(NULLIF(_patch->>'wa_access_token',''), wa_access_token),
    wa_app_secret = COALESCE(NULLIF(_patch->>'wa_app_secret',''), wa_app_secret),
    wa_default_lang = COALESCE(NULLIF(_patch->>'wa_default_lang',''), wa_default_lang),
    wa_min_cart_age_minutes = COALESCE((_patch->>'wa_min_cart_age_minutes')::int, wa_min_cart_age_minutes),
    wa_max_cart_age_hours = COALESCE((_patch->>'wa_max_cart_age_hours')::int, wa_max_cart_age_hours),
    wa_daily_cap_per_phone = COALESCE((_patch->>'wa_daily_cap_per_phone')::int, wa_daily_cap_per_phone),
    wa_tier_limit = COALESCE((_patch->>'wa_tier_limit')::int, wa_tier_limit),
    wa_queue_batch_size = COALESCE((_patch->>'wa_queue_batch_size')::int, wa_queue_batch_size),
    wa_pilot_mode = COALESCE((_patch->>'wa_pilot_mode')::boolean, wa_pilot_mode),
    wa_pilot_cohort = COALESCE(cohort, wa_pilot_cohort),
    updated_at = now()
  WHERE id = pid;

  RETURN public.admin_get_platform_wa_config();
END $function$;
