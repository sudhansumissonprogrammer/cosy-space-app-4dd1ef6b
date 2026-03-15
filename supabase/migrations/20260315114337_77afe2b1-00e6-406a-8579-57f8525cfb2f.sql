
-- Add order_number column for simple, human-readable order IDs
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number SERIAL;

-- Create a unique index on order_number
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_unique ON public.orders (order_number);
