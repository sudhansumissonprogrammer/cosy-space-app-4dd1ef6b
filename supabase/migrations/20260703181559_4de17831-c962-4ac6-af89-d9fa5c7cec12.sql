UPDATE public.platform_config
SET wa_require_marketing_consent = false, updated_at = now()
WHERE wa_require_marketing_consent = true;