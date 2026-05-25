DROP POLICY IF EXISTS "Anyone can insert leads" ON public.customer_leads;

CREATE POLICY "Anyone can insert leads"
ON public.customer_leads
FOR INSERT
WITH CHECK (true);

GRANT INSERT ON public.customer_leads TO PUBLIC;