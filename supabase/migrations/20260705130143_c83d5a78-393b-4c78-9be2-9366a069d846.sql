
ALTER TABLE public.platform_config ADD COLUMN IF NOT EXISTS wa_app_id text;

CREATE OR REPLACE FUNCTION public.admin_get_platform_wa_config()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT * INTO r FROM public.platform_config LIMIT 1;
  RETURN jsonb_build_object(
    'whatsapp_mode', r.whatsapp_mode,
    'wa_enabled', r.wa_enabled,
    'wa_phone_number_id', r.wa_phone_number_id,
    'wa_business_phone', r.wa_business_phone,
    'wa_waba_id', r.wa_waba_id,
    'wa_app_id', r.wa_app_id,
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
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE pid uuid; cohort uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  SELECT id INTO pid FROM public.platform_config LIMIT 1;
  IF _patch ? 'wa_pilot_cohort' THEN
    SELECT COALESCE(array_agg(value::uuid), ARRAY[]::uuid[]) INTO cohort
      FROM jsonb_array_elements_text(_patch->'wa_pilot_cohort') AS value WHERE length(value) > 0;
  END IF;
  UPDATE public.platform_config SET
    whatsapp_mode = COALESCE(_patch->>'whatsapp_mode', whatsapp_mode),
    wa_enabled = COALESCE((_patch->>'wa_enabled')::boolean, wa_enabled),
    wa_phone_number_id = COALESCE(NULLIF(_patch->>'wa_phone_number_id',''), wa_phone_number_id),
    wa_business_phone = COALESCE(NULLIF(_patch->>'wa_business_phone',''), wa_business_phone),
    wa_waba_id = COALESCE(NULLIF(_patch->>'wa_waba_id',''), wa_waba_id),
    wa_app_id = COALESCE(NULLIF(_patch->>'wa_app_id',''), wa_app_id),
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
    wa_throttle_marketing = COALESCE((_patch->>'wa_throttle_marketing')::boolean, wa_throttle_marketing),
    updated_at = now()
  WHERE id = pid;
  RETURN public.admin_get_platform_wa_config();
END $function$;
