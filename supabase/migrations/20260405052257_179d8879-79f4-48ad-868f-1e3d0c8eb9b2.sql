ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS partial_payment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partial_payment_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS partial_payment_value numeric DEFAULT NULL;