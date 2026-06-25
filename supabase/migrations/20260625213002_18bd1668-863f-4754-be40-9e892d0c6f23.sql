-- C8: Remove unscoped public UPDATE on abandoned_carts.
-- The old policy let any anon UPDATE every cart row (only checked store-not-suspended,
-- no row identity check). Store-owner management policy ("Store owners can manage
-- abandoned carts") remains. Storefront writes go through service_role edge fns
-- which bypass RLS, so no functional regression.
DROP POLICY IF EXISTS "Anyone can update abandoned carts by id" ON public.abandoned_carts;

-- C9: Remove permissive INSERT on whatsapp_optouts.
-- The old policy was WITH CHECK (true) TO public — anyone could opt-out any phone.
-- Edge functions use service_role (bypasses RLS) so opt-outs from webhooks /
-- reply-handler / dashboard admin tooling continue to work.
DROP POLICY IF EXISTS "Edge functions can insert optouts" ON public.whatsapp_optouts;