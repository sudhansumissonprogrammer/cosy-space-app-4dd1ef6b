-- Allow authenticated users (storefront customers) to also view active stores
CREATE POLICY "Authenticated can view active stores"
ON public.stores
FOR SELECT
TO authenticated
USING (is_suspended = false);