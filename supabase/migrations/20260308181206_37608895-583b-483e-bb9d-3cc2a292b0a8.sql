
-- Enforce blocked user check on stores
DROP POLICY IF EXISTS "Owners can create stores" ON public.stores;
CREATE POLICY "Owners can create stores" ON public.stores
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND NOT public.is_user_blocked());

DROP POLICY IF EXISTS "Owners can update own stores" ON public.stores;
CREATE POLICY "Owners can update own stores" ON public.stores
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id AND NOT public.is_user_blocked());

DROP POLICY IF EXISTS "Owners can delete own stores" ON public.stores;
CREATE POLICY "Owners can delete own stores" ON public.stores
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id AND NOT public.is_user_blocked());

-- Enforce blocked user check on products
DROP POLICY IF EXISTS "Store owners can create products" ON public.products;
CREATE POLICY "Store owners can create products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (public.is_store_owner(store_id) AND NOT public.is_user_blocked());

DROP POLICY IF EXISTS "Store owners can update products" ON public.products;
CREATE POLICY "Store owners can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.is_user_blocked());

DROP POLICY IF EXISTS "Store owners can delete products" ON public.products;
CREATE POLICY "Store owners can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.is_user_blocked());

-- Enforce blocked user check on whatsapp_orders (update/delete only, insert stays public)
DROP POLICY IF EXISTS "Store owners can update whatsapp orders" ON public.whatsapp_orders;
CREATE POLICY "Store owners can update whatsapp orders" ON public.whatsapp_orders
  FOR UPDATE TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.is_user_blocked());

DROP POLICY IF EXISTS "Store owners can delete whatsapp orders" ON public.whatsapp_orders;
CREATE POLICY "Store owners can delete whatsapp orders" ON public.whatsapp_orders
  FOR DELETE TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.is_user_blocked());

-- Enforce blocked user on categories management
DROP POLICY IF EXISTS "Store owners can manage categories" ON public.categories;
CREATE POLICY "Store owners can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (public.is_store_owner(store_id) AND NOT public.is_user_blocked())
  WITH CHECK (public.is_store_owner(store_id) AND NOT public.is_user_blocked());
