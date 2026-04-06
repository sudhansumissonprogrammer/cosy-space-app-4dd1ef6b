
-- Revoke SELECT on sensitive columns from anon and authenticated roles
REVOKE SELECT (owner_email) ON public.stores FROM anon;
REVOKE SELECT (owner_email) ON public.stores FROM authenticated;

REVOKE SELECT (domain_verification_token) ON public.stores FROM anon;
REVOKE SELECT (domain_verification_token) ON public.stores FROM authenticated;

-- Helper function: get store owner email for public display (about page, invoices)
CREATE OR REPLACE FUNCTION public.get_store_public_email(_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT owner_email
  FROM public.stores
  WHERE id = _store_id AND is_suspended = false
  LIMIT 1;
$$;

-- Helper function: get domain verification token (owner only)
CREATE OR REPLACE FUNCTION public.get_own_domain_token(_store_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT domain_verification_token
  FROM public.stores
  WHERE id = _store_id AND owner_id = auth.uid()
  LIMIT 1;
$$;
