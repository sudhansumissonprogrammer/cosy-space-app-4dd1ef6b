-- Allow storefront customers to cancel their own orders (only while pending/confirmed)
DROP POLICY IF EXISTS "Storefront customers can cancel own orders" ON public.orders;

CREATE POLICY "Storefront customers can cancel own orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  storefront_customer_id IN (
    SELECT id FROM public.storefront_customers WHERE user_id = auth.uid()
  )
  AND status IN ('pending', 'confirmed')
)
WITH CHECK (
  storefront_customer_id IN (
    SELECT id FROM public.storefront_customers WHERE user_id = auth.uid()
  )
  AND status = 'cancelled'
);