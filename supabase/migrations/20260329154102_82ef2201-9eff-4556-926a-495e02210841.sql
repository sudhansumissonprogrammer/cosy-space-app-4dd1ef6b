
-- Fix 1: Remove anon direct SELECT access to stores table (sensitive fields like meta_access_token, owner_email, domain_verification_token)
-- The storefront uses get_storefront_data/get_storefront_shell RPC (SECURITY DEFINER) so anon doesn't need direct access
DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;

-- Fix 2: Restrict push_subscriptions DELETE to store owners instead of allowing anyone
DROP POLICY IF EXISTS "Anyone can delete own subscription" ON public.push_subscriptions;

CREATE POLICY "Store owners can delete push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (is_store_owner(store_id));
