ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_external_id text,
  ADD COLUMN IF NOT EXISTS buyer_email text;