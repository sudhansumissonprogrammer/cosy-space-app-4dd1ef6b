
-- Revoke SELECT on sensitive columns from public-facing roles
REVOKE SELECT (meta_access_token) ON public.stores FROM anon;
REVOKE SELECT (meta_access_token) ON public.stores FROM authenticated;

REVOKE SELECT (razorpay_key_secret) ON public.store_payment_config FROM anon;
REVOKE SELECT (razorpay_key_secret) ON public.store_payment_config FROM authenticated;

-- Helper function: store owner reads their own meta_access_token
CREATE OR REPLACE FUNCTION public.get_own_store_meta_token(_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT meta_access_token
  FROM public.stores
  WHERE id = _store_id AND owner_id = auth.uid()
  LIMIT 1;
$$;

-- Helper function: store owner reads their own razorpay_key_secret
CREATE OR REPLACE FUNCTION public.get_own_payment_secret(_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT razorpay_key_secret
  FROM public.store_payment_config
  WHERE store_id = _store_id
    AND EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid())
  LIMIT 1;
$$;
