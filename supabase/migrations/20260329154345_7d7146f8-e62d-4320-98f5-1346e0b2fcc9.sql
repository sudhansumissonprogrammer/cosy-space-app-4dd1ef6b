
-- Ensure anon SELECT policy on stores is removed (re-applying fix)
DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;

-- Ensure old push_subscriptions DELETE policy is gone and new one exists
DROP POLICY IF EXISTS "Anyone can delete own subscription" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Store owners can delete push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Store owners can delete push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (is_store_owner(store_id));
