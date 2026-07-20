DROP INDEX IF EXISTS public.idx_orders_meta_purchase_deferred_pending;
ALTER TABLE public.orders
  DROP COLUMN IF EXISTS meta_purchase_deferred_until,
  DROP COLUMN IF EXISTS meta_refund_fired_at;