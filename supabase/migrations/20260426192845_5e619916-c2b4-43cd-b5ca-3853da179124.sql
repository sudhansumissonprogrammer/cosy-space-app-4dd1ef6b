-- 1. Add Cashfree columns to store_payment_config
ALTER TABLE public.store_payment_config
  ADD COLUMN IF NOT EXISTS cashfree_app_id text,
  ADD COLUMN IF NOT EXISTS cashfree_secret_key text,
  ADD COLUMN IF NOT EXISTS cashfree_env text NOT NULL DEFAULT 'production';

-- 2. Constrain env values
DO $$ BEGIN
  ALTER TABLE public.store_payment_config
    ADD CONSTRAINT store_payment_config_cashfree_env_chk
    CHECK (cashfree_env IN ('production','sandbox'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Update get_store_payment_config to expose cashfree_app_id + env (NOT secret)
CREATE OR REPLACE FUNCTION public.get_store_payment_config(_store_id uuid)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'id', id,
    'store_id', store_id,
    'payment_methods', payment_methods,
    'razorpay_key_id', razorpay_key_id,
    'cashfree_app_id', cashfree_app_id,
    'cashfree_env', cashfree_env,
    'created_at', created_at,
    'updated_at', updated_at
  )
  FROM store_payment_config
  WHERE store_id = _store_id
  LIMIT 1;
$function$;

-- 4. New RPC: store owner can fetch their own cashfree secret
CREATE OR REPLACE FUNCTION public.get_own_cashfree_secret(_store_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT cashfree_secret_key
  FROM public.store_payment_config
  WHERE store_id = _store_id
    AND EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id AND owner_id = auth.uid())
  LIMIT 1;
$function$;