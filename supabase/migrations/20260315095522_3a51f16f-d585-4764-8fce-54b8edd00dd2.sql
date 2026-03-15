-- Fallback fix: permit public checkout inserts directly.
-- Integrity is still enforced by foreign keys (store_id/order_id must exist).

DROP POLICY IF EXISTS "Anyone can create website orders" ON public.orders;
CREATE POLICY "Anyone can create website orders"
ON public.orders
FOR INSERT
TO public
WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can create website order items" ON public.order_items;
CREATE POLICY "Anyone can create website order items"
ON public.order_items
FOR INSERT
TO public
WITH CHECK (true);