DROP POLICY IF EXISTS "Anyone can insert leads" ON public.customer_leads;

CREATE POLICY "Anyone can insert leads"
ON public.customer_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (public.is_store_active(store_id));