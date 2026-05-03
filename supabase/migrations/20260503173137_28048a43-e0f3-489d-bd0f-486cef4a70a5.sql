ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_ip text,
  ADD COLUMN IF NOT EXISTS buyer_user_agent text,
  ADD COLUMN IF NOT EXISTS buyer_fbc text,
  ADD COLUMN IF NOT EXISTS buyer_fbp text,
  ADD COLUMN IF NOT EXISTS meta_event_id text,
  ADD COLUMN IF NOT EXISTS meta_purchase_fired_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_meta_purchase_fired_at
  ON public.orders (meta_purchase_fired_at)
  WHERE meta_purchase_fired_at IS NULL;