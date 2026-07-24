DROP FUNCTION IF EXISTS public.wa_autologin_bundle(text, uuid);
CREATE OR REPLACE FUNCTION public.wa_autologin_bundle(_phone text, _store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text := _phone || '@phone.guest';
  v_user_id uuid;
  v_ensured boolean := false;
  v_address jsonb;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = v_email LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('user_id', NULL, 'address', NULL, 'ensured_customer', false);
  END IF;

  IF _store_id IS NOT NULL THEN
    INSERT INTO public.storefront_customers (user_id, store_id, phone)
    VALUES (v_user_id, _store_id, _phone)
    ON CONFLICT (user_id, store_id) DO NOTHING;
    v_ensured := true;
  END IF;

  SELECT to_jsonb(a) - 'created_at' - 'updated_at'
    INTO v_address
  FROM public.customer_addresses a
  WHERE a.storefront_customer_id IN (
    SELECT id FROM public.storefront_customers WHERE user_id = v_user_id
  )
  ORDER BY a.is_default DESC NULLS LAST, a.updated_at DESC NULLS LAST
  LIMIT 1;

  RETURN jsonb_build_object(
    'user_id', v_user_id,
    'address', v_address,
    'ensured_customer', v_ensured
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.wa_autologin_bundle(text, uuid) TO service_role;