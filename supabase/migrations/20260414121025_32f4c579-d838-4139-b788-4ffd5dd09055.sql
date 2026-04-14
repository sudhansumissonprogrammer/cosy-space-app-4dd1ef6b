ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.stores TO authenticated;
REVOKE ALL ON TABLE public.stores FROM anon;

DROP POLICY IF EXISTS "store owners can view their own stores" ON public.stores;
DROP POLICY IF EXISTS "store owners can create their own stores" ON public.stores;
DROP POLICY IF EXISTS "store owners can update their own stores" ON public.stores;
DROP POLICY IF EXISTS "store owners can delete their own stores" ON public.stores;

CREATE POLICY "store owners can view their own stores"
ON public.stores
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "store owners can create their own stores"
ON public.stores
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "store owners can update their own stores"
ON public.stores
FOR UPDATE
TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "store owners can delete their own stores"
ON public.stores
FOR DELETE
TO authenticated
USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));