
-- Allow authenticated users to view active products (fixes storefront for logged-in customers)
CREATE POLICY "Authenticated can view active products"
ON public.products
FOR SELECT
TO authenticated
USING (is_active = true);

-- Allow authenticated users to view payment config
CREATE POLICY "Authenticated can view payment config"
ON public.store_payment_config
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to view shipping config
CREATE POLICY "Authenticated can view shipping config"
ON public.store_shipping_config
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to view tax config
CREATE POLICY "Authenticated can view tax config"
ON public.store_tax_config
FOR SELECT
TO authenticated
USING (true);
