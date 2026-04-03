-- Add checkout_token column for idempotent order creation
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS checkout_token TEXT;

-- Unique index: one order per checkout token per store
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_checkout_token_store
ON public.orders (store_id, checkout_token)
WHERE checkout_token IS NOT NULL;