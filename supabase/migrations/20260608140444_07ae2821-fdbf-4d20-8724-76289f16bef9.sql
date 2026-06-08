
DROP FUNCTION IF EXISTS public.get_store_payment_config(uuid);

CREATE OR REPLACE FUNCTION public.get_store_payment_config(_store_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'id', id,
    'store_id', store_id,
    'payment_methods', payment_methods,
    'razorpay_key_id', razorpay_key_id,
    'cashfree_app_id', cashfree_app_id,
    'cashfree_env', cashfree_env,
    'payu_merchant_key', payu_merchant_key,
    'payu_env', payu_env,
    'created_at', created_at,
    'updated_at', updated_at
  )
  FROM public.store_payment_config
  WHERE store_id = _store_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_payment_config(uuid) TO anon, authenticated;
