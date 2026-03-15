
-- Create a SECURITY DEFINER function to check if store is active (bypasses RLS on stores)
CREATE OR REPLACE FUNCTION public.is_store_active(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND is_suspended = false
  )
$$;

-- Drop and recreate the orders INSERT policy for website orders
DROP POLICY IF EXISTS "Anyone can create website orders" ON public.orders;
CREATE POLICY "Anyone can create website orders"
  ON public.orders FOR INSERT
  TO public
  WITH CHECK (is_store_active(store_id));

-- Also fix order_items INSERT policy that has the same nested RLS issue
DROP POLICY IF EXISTS "Anyone can create website order items" ON public.order_items;
CREATE POLICY "Anyone can create website order items"
  ON public.order_items FOR INSERT
  TO public
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id AND is_store_active(o.store_id)
    )
  );
