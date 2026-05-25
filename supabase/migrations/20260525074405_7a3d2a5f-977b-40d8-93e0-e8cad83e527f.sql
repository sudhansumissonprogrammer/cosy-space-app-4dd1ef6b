DROP POLICY IF EXISTS "Anyone can insert leads" ON public.customer_leads;

CREATE POLICY "Anyone can insert leads"
ON public.customer_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (true);