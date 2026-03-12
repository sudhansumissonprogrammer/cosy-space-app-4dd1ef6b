
-- Tighten order_items INSERT: require order exists in a non-suspended store
DROP POLICY IF EXISTS "Anyone can create website order items" ON public.order_items;
CREATE POLICY "Anyone can create website order items"
ON public.order_items
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = order_items.order_id AND s.is_suspended = false
  )
);

-- Tighten whatsapp_orders INSERT: require valid non-suspended store
DROP POLICY IF EXISTS "Anyone can create whatsapp orders" ON public.whatsapp_orders;
CREATE POLICY "Anyone can create whatsapp orders"
ON public.whatsapp_orders
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = whatsapp_orders.store_id AND stores.is_suspended = false
  )
);
