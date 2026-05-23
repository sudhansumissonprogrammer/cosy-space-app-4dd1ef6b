-- Sensitive column lockdown.
-- Edge functions use the service role and are unaffected by these REVOKEs.
-- Client UI already reads owner_email via the get_storefront_shell RPC and
-- meta_access_token via a dedicated RPC, so this only removes a direct
-- bulk-read attack surface.

-- 1) stores.owner_email — keep readable only via the SECURITY DEFINER
--    shell RPC; revoke direct table reads for all client roles.
REVOKE SELECT (owner_email) ON public.stores FROM anon, authenticated;

-- 2) whatsapp_config.access_token — revoke direct client reads.
--    Storefront/backend flows use service-role edge functions.
REVOKE SELECT (access_token) ON public.whatsapp_config FROM anon, authenticated;

-- 3) platform_config.wa_access_token — admin/service-role only.
REVOKE SELECT (wa_access_token) ON public.platform_config FROM anon, authenticated;
