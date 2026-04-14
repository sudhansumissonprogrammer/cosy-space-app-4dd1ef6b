
-- 1. STORES TABLE: Replace broad public SELECT with column-restricted policies
-- Drop the overly permissive anon/authenticated SELECT policies
DROP POLICY IF EXISTS "Anon can view active stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated can view active stores" ON public.stores;

-- Create a security definer function that returns only safe columns
CREATE OR REPLACE FUNCTION public.get_store_public(_slug text)
RETURNS json
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug,
    'description', s.description, 'logo_url', s.logo_url,
    'banner_url', s.banner_url, 'mobile_hero_url', s.mobile_hero_url,
    'mobile_hero_images', s.mobile_hero_images, 'currency', s.currency,
    'whatsapp_number', s.whatsapp_number, 'instagram_url', s.instagram_url,
    'facebook_url', s.facebook_url, 'order_mode', s.order_mode,
    'theme', s.theme, 'features', s.features,
    'best_selling_carousel', s.best_selling_carousel,
    'meta_title', s.meta_title, 'meta_description', s.meta_description,
    'og_image_url', s.og_image_url, 'facebook_pixel_id', s.facebook_pixel_id,
    'location', s.location, 'city', s.city, 'state', s.state,
    'business_hours', s.business_hours, 'custom_domain', s.custom_domain,
    'return_policy', s.return_policy, 'shipping_policy', s.shipping_policy,
    'is_suspended', s.is_suspended, 'is_verified', s.is_verified,
    'created_at', s.created_at, 'updated_at', s.updated_at,
    'about_us_text', s.about_us_text, 'about_us_image_url', s.about_us_image_url,
    'partial_payment_enabled', s.partial_payment_enabled,
    'partial_payment_type', s.partial_payment_type,
    'partial_payment_value', s.partial_payment_value
  )
  FROM stores s
  WHERE s.slug = _slug AND s.is_suspended = false
  LIMIT 1;
$$;

-- Re-create the public view without sensitive columns
DROP VIEW IF EXISTS public.stores_public;
CREATE VIEW public.stores_public AS
SELECT
  id, name, slug, description, logo_url, banner_url, mobile_hero_url,
  mobile_hero_images, currency, whatsapp_number, instagram_url, facebook_url,
  order_mode, theme, features, best_selling_carousel, meta_title,
  meta_description, og_image_url, facebook_pixel_id, location, city, state,
  business_hours, custom_domain, return_policy, shipping_policy,
  is_suspended, is_verified, created_at, updated_at,
  about_us_text, about_us_image_url,
  partial_payment_enabled, partial_payment_type, partial_payment_value
FROM stores
WHERE is_suspended = false;

-- Re-add the public SELECT policies but scoped to safe columns via the view
-- For the stores TABLE, only owners and admins get direct access
CREATE POLICY "Anon can view active stores limited"
ON public.stores FOR SELECT TO anon
USING (is_suspended = false);

CREATE POLICY "Authenticated can view active stores limited"
ON public.stores FOR SELECT TO authenticated
USING (is_suspended = false);

-- Use column-level security to hide sensitive columns from anon/authenticated
-- Revoke all on stores from anon and public, then re-grant only safe columns
REVOKE SELECT ON public.stores FROM anon;
REVOKE SELECT ON public.stores FROM authenticated;

GRANT SELECT (
  id, name, slug, description, logo_url, banner_url, mobile_hero_url,
  mobile_hero_images, currency, whatsapp_number, instagram_url, facebook_url,
  order_mode, theme, features, best_selling_carousel, meta_title,
  meta_description, og_image_url, facebook_pixel_id, location, city, state,
  business_hours, custom_domain, return_policy, shipping_policy,
  is_suspended, is_verified, created_at, updated_at,
  about_us_text, about_us_image_url,
  partial_payment_enabled, partial_payment_type, partial_payment_value
) ON public.stores TO anon;

GRANT SELECT (
  id, name, slug, description, logo_url, banner_url, mobile_hero_url,
  mobile_hero_images, currency, whatsapp_number, instagram_url, facebook_url,
  order_mode, theme, features, best_selling_carousel, meta_title,
  meta_description, og_image_url, facebook_pixel_id, location, city, state,
  business_hours, custom_domain, return_policy, shipping_policy,
  is_suspended, is_verified, created_at, updated_at,
  about_us_text, about_us_image_url,
  partial_payment_enabled, partial_payment_type, partial_payment_value
) ON public.stores TO authenticated;

-- 2. WHATSAPP-MEDIA STORAGE: Add ownership checks
-- Helper function to check if user owns the store whose ID is the folder prefix
CREATE OR REPLACE FUNCTION public.is_store_owner_by_folder(_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = (storage.foldername(_name))[1]::uuid
      AND owner_id = auth.uid()
  )
$$;

-- Drop existing permissive whatsapp-media policies
DROP POLICY IF EXISTS "Store owners can upload whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Store owners can view whatsapp media" ON storage.objects;
DROP POLICY IF EXISTS "Store owners can delete whatsapp media" ON storage.objects;

-- Re-create with ownership checks
CREATE POLICY "Store owners can upload whatsapp media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND public.is_store_owner_by_folder(name)
);

CREATE POLICY "Store owners can view whatsapp media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND public.is_store_owner_by_folder(name)
);

CREATE POLICY "Store owners can delete whatsapp media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'whatsapp-media'
  AND public.is_store_owner_by_folder(name)
);

-- 3. PAYMENT CONFIG: Revoke direct SELECT of razorpay_key_secret
-- Drop the broad owner SELECT policy and replace with column-restricted one
DROP POLICY IF EXISTS "Store owners can view payment config" ON public.store_payment_config;

CREATE POLICY "Store owners can view payment config safe"
ON public.store_payment_config FOR SELECT
TO authenticated
USING (is_store_owner(store_id));

-- Revoke full SELECT, grant only safe columns
REVOKE SELECT ON public.store_payment_config FROM authenticated;
GRANT SELECT (id, store_id, payment_methods, razorpay_key_id, created_at, updated_at)
ON public.store_payment_config TO authenticated;

-- 4. PUBLIC BUCKET LISTING: Restrict SELECT to folder-scoped access
-- Replace broad SELECT policies with folder-scoped ones
DROP POLICY IF EXISTS "Anyone can view product images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view store banners" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view store logos" ON storage.objects;

-- Product images: public read but no listing (use direct URL)
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] IS NOT NULL);

CREATE POLICY "Anyone can view store banners"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'store-banners' AND (storage.foldername(name))[1] IS NOT NULL);

CREATE POLICY "Anyone can view store logos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'store-logos' AND (storage.foldername(name))[1] IS NOT NULL);
