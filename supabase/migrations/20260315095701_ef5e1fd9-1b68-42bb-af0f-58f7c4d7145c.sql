-- Restore secure checkout insert policies (remove always-true checks)

DROP POLICY IF EXISTS "Anyone can create website orders" ON public.orders;
CREATE POLICY "Anyone can create website orders"
ON public.orders
FOR INSERT
TO public
WITH CHECK (public.is_store_active(store_id));

DROP POLICY IF EXISTS "Anyone can create website order items" ON public.order_items;
CREATE POLICY "Anyone can create website order items"
ON public.order_items
FOR INSERT
TO public
WITH CHECK (public.can_create_website_order_item(order_id));