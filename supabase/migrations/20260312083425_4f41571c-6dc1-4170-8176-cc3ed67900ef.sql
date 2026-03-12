
-- Tighten orders INSERT - already has store suspension check, so this is OK
-- The remaining true policies are customer_leads INSERT and page_views INSERT
-- These are intentional public-facing features but let's add store validation

DROP POLICY IF EXISTS "Anyone can insert leads" ON public.customer_leads;
CREATE POLICY "Anyone can insert leads"
ON public.customer_leads
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = customer_leads.store_id AND stores.is_suspended = false
  )
);

DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = page_views.store_id AND stores.is_suspended = false
  )
);
