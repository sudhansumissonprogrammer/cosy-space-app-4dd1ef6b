-- Harden guest checkout insert policies to avoid false RLS denials
-- while still enforcing active-store validation.

CREATE OR REPLACE FUNCTION public.can_create_website_order(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.stores s
    WHERE s.id = _store_id
      AND s.is_suspended = false
  )
$$;

CREATE OR REPLACE FUNCTION public.can_create_website_order_item(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.stores s ON s.id = o.store_id
    WHERE o.id = _order_id
      AND s.is_suspended = false
  )
$$;

GRANT EXECUTE ON FUNCTION public.can_create_website_order(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_website_order_item(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can create website orders" ON public.orders;
CREATE POLICY "Anyone can create website orders"
ON public.orders
FOR INSERT
TO public
WITH CHECK (public.can_create_website_order(store_id));

DROP POLICY IF EXISTS "Anyone can create website order items" ON public.order_items;
CREATE POLICY "Anyone can create website order items"
ON public.order_items
FOR INSERT
TO public
WITH CHECK (public.can_create_website_order_item(order_id));