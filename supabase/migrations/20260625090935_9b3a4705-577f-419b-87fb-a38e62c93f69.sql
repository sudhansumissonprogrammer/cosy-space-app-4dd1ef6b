CREATE INDEX IF NOT EXISTS idx_products_store_created ON public.products(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_store_status_created ON public.orders(store_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);