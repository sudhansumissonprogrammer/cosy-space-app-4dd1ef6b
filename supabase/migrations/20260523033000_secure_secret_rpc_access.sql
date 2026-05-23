-- Secure RPC access for owner/admin-only secrets that must still be editable in dashboards.

CREATE OR REPLACE FUNCTION public.get_own_whatsapp_config(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg public.whatsapp_config%ROWTYPE;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _cfg
  FROM public.whatsapp_config
  WHERE store_id = _store_id
  LIMIT 1;

  IF _cfg.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', _cfg.id,
    'store_id', _cfg.store_id,
    'access_token', _cfg.access_token,
    'phone_number_id', _cfg.phone_number_id,
    'waba_id', _cfg.waba_id,
    'business_phone', _cfg.business_phone,
    'is_active', _cfg.is_active,
    'marketing_mode', _cfg.marketing_mode,
    'created_at', _cfg.created_at,
    'updated_at', _cfg.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_platform_config()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cfg public.platform_config%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO _cfg
  FROM public.platform_config
  ORDER BY created_at ASC NULLS LAST
  LIMIT 1;

  IF _cfg.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', _cfg.id,
    'platform_name', _cfg.platform_name,
    'default_currency', _cfg.default_currency,
    'wa_phone_number_id', _cfg.wa_phone_number_id,
    'wa_access_token', _cfg.wa_access_token,
    'wa_business_phone', _cfg.wa_business_phone,
    'created_at', _cfg.created_at,
    'updated_at', _cfg.updated_at
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_own_whatsapp_config(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_platform_config() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_whatsapp_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_platform_config() TO authenticated;
