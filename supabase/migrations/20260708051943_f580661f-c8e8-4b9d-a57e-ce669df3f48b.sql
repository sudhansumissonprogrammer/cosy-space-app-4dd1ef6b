
ALTER TABLE public.store_payment_config
  ADD COLUMN IF NOT EXISTS prepaid_discount_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prepaid_discount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS prepaid_discount_value numeric NOT NULL DEFAULT 0;

ALTER TABLE public.store_payment_config
  DROP CONSTRAINT IF EXISTS store_payment_config_prepaid_discount_type_chk;
ALTER TABLE public.store_payment_config
  ADD CONSTRAINT store_payment_config_prepaid_discount_type_chk
  CHECK (prepaid_discount_type IN ('fixed','percentage'));

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
    'prepaid_discount_enabled', prepaid_discount_enabled,
    'prepaid_discount_type', prepaid_discount_type,
    'prepaid_discount_value', prepaid_discount_value,
    'created_at', created_at,
    'updated_at', updated_at
  )
  FROM public.store_payment_config
  WHERE store_id = _store_id
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_payment_config(uuid) TO anon, authenticated;
