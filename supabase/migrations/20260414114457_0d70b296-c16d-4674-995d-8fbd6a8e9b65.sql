
-- Fix security definer view warning
DROP VIEW IF EXISTS public.stores_public;
CREATE VIEW public.stores_public
WITH (security_invoker = true)
AS
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
