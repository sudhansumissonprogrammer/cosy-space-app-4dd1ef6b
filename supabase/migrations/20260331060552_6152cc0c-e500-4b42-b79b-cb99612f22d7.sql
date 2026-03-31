CREATE POLICY "Anon can view active stores"
ON public.stores FOR SELECT
TO anon
USING (is_suspended = false);