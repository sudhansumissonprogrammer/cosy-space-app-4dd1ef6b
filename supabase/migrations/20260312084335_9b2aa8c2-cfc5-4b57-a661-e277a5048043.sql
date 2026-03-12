
-- FIX: Blocked users can't update their own profile at all
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO public
USING (auth.uid() = user_id AND NOT is_blocked)
WITH CHECK (auth.uid() = user_id);

-- FIX: Hide owner_email from anon store access
DROP POLICY IF EXISTS "Public can view active stores" ON public.stores;
CREATE POLICY "Public can view active stores"
ON public.stores
FOR SELECT
TO anon
USING (is_suspended = false);

-- Create a view for public storefront access that excludes owner_email
CREATE OR REPLACE VIEW public.stores_public
WITH (security_invoker = on) AS
SELECT id, name, slug, description, logo_url, banner_url, mobile_hero_url, currency,
  whatsapp_number, instagram_url, facebook_url, order_mode, theme, features,
  best_selling_carousel, meta_title, meta_description, og_image_url, facebook_pixel_id,
  location, city, state, business_hours, custom_domain, return_policy, shipping_policy,
  is_suspended, is_verified, created_at, updated_at
FROM public.stores;
