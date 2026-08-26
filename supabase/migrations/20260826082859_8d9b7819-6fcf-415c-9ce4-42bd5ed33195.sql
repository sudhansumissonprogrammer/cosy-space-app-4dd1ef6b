ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS supplier_out_of_stock boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS supplier_stock_checked_at timestamp with time zone;