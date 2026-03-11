
-- Remove the overly permissive authenticated SELECT that exposes secrets
DROP POLICY IF EXISTS "Authenticated can view payment config" ON public.store_payment_config;

-- Authenticated users should only view via the public view (which excludes secrets)
-- Store owners already have their own SELECT policy
