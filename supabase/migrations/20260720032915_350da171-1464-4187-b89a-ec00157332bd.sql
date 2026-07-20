ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS meta_refund_fired_at timestamptz,
  ADD COLUMN IF NOT EXISTS meta_purchase_deferred_until timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_meta_purchase_deferred
  ON public.orders (meta_purchase_deferred_until)
  WHERE meta_purchase_fired_at IS NULL AND meta_purchase_deferred_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_meta_refund_pending
  ON public.orders (id)
  WHERE meta_purchase_fired_at IS NOT NULL
    AND meta_refund_fired_at IS NULL
    AND status IN ('cancelled', 'refunded');