-- Add partial payment columns to products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS partial_payment_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partial_payment_type text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS partial_payment_value numeric DEFAULT NULL;

-- Add partial payment tracking columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS advance_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due numeric NOT NULL DEFAULT 0;