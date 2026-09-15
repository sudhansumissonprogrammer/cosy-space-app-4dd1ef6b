CREATE POLICY "Service functions manage auth session mint leases"
ON public.auth_session_mint_leases
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);