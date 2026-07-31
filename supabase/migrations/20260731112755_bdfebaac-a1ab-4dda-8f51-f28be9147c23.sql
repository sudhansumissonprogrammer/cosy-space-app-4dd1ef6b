-- Set-returning, security-definer helpers: evaluated ONCE per query as an InitPlan
CREATE OR REPLACE FUNCTION public.my_store_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.stores WHERE owner_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_customer_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.storefront_customers WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.my_order_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id FROM public.orders o
  WHERE o.store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
     OR (o.storefront_customer_id IS NOT NULL
         AND o.storefront_customer_id IN (SELECT id FROM public.storefront_customers WHERE user_id = auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
$$;

GRANT EXECUTE ON FUNCTION public.my_store_ids() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.my_customer_ids() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.my_order_ids() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- ORDERS: collapse 3 per-row permissive SELECT policies into 1 InitPlan-based policy
DROP POLICY IF EXISTS "Store owners can view orders" ON public.orders;
DROP POLICY IF EXISTS "Storefront customers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;

CREATE POLICY "Orders readable by owner, customer or admin"
ON public.orders FOR SELECT
USING (
  store_id IN (SELECT public.my_store_ids())
  OR (storefront_customer_id IS NOT NULL AND storefront_customer_id IN (SELECT public.my_customer_ids()))
  OR (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Store owners can update orders" ON public.orders;
CREATE POLICY "Store owners can update orders"
ON public.orders FOR UPDATE
USING (store_id IN (SELECT public.my_store_ids()))
WITH CHECK (store_id IN (SELECT public.my_store_ids()));

DROP POLICY IF EXISTS "Store owners can delete orders" ON public.orders;
CREATE POLICY "Store owners can delete orders"
ON public.orders FOR DELETE
USING (store_id IN (SELECT public.my_store_ids()));

-- ORDER_ITEMS: the 234ms offender. is_order_owner() ran once per row.
DROP POLICY IF EXISTS "Store owners can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Storefront customers can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can view all order items" ON public.order_items;

CREATE POLICY "Order items readable by owner, customer or admin"
ON public.order_items FOR SELECT
USING (
  order_id IN (SELECT public.my_order_ids())
  OR (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Store owners can update order items" ON public.order_items;
CREATE POLICY "Store owners can update order items"
ON public.order_items FOR UPDATE
USING (order_id IN (SELECT public.my_order_ids()))
WITH CHECK (order_id IN (SELECT public.my_order_ids()));

DROP POLICY IF EXISTS "Store owners can delete order items" ON public.order_items;
CREATE POLICY "Store owners can delete order items"
ON public.order_items FOR DELETE
USING (order_id IN (SELECT public.my_order_ids()));

-- PRODUCTS
DROP POLICY IF EXISTS "Store owners can view products" ON public.products;
DROP POLICY IF EXISTS "Admins can view all products" ON public.products;
DROP POLICY IF EXISTS "Public can view active products" ON public.products;

CREATE POLICY "Products readable by public, owner or admin"
ON public.products FOR SELECT
USING (
  is_active = true
  OR store_id IN (SELECT public.my_store_ids())
  OR (SELECT public.is_admin())
);

DROP POLICY IF EXISTS "Store owners can update products" ON public.products;
CREATE POLICY "Store owners can update products"
ON public.products FOR UPDATE
USING (store_id IN (SELECT public.my_store_ids()) AND NOT (SELECT public.is_user_blocked()))
WITH CHECK (store_id IN (SELECT public.my_store_ids()) AND NOT (SELECT public.is_user_blocked()));

DROP POLICY IF EXISTS "Store owners can delete products" ON public.products;
CREATE POLICY "Store owners can delete products"
ON public.products FOR DELETE
USING (store_id IN (SELECT public.my_store_ids()) AND NOT (SELECT public.is_user_blocked()));

-- ABANDONED_CARTS
DROP POLICY IF EXISTS "Store owners can manage abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Store owners can update abandoned carts" ON public.abandoned_carts;

CREATE POLICY "Store owners can manage abandoned carts"
ON public.abandoned_carts FOR ALL
USING (store_id IN (SELECT public.my_store_ids()))
WITH CHECK (store_id IN (SELECT public.my_store_ids()));
