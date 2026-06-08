
ALTER TABLE public.store_payment_config
  ADD COLUMN IF NOT EXISTS payu_merchant_key text,
  ADD COLUMN IF NOT EXISTS payu_merchant_salt text,
  ADD COLUMN IF NOT EXISTS payu_env text NOT NULL DEFAULT 'production';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'store_payment_config_payu_env_chk'
  ) THEN
    ALTER TABLE public.store_payment_config
      ADD CONSTRAINT store_payment_config_payu_env_chk
      CHECK (payu_env IN ('production','sandbox'));
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_own_payu_secret(uuid);

CREATE OR REPLACE FUNCTION public.get_own_payu_secret(_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT payu_merchant_salt
  FROM public.store_payment_config
  WHERE store_id = _store_id
    AND (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'));
$$;

GRANT EXECUTE ON FUNCTION public.get_own_payu_secret(uuid) TO authenticated;
