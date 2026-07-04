
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_repeat_customer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS customer_order_index integer,
  ADD COLUMN IF NOT EXISTS attribution jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_store_repeat_created
  ON public.orders(store_id, is_repeat_customer, created_at DESC);
