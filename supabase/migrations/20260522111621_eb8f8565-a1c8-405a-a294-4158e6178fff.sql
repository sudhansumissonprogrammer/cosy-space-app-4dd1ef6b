-- Revoke column-level SELECT on sensitive token columns from anon + authenticated.
-- Store owners read these via SECURITY DEFINER RPCs (get_own_store_meta_token, get_own_domain_token).
REVOKE SELECT (meta_access_token) ON public.stores FROM anon, authenticated, PUBLIC;
REVOKE SELECT (domain_verification_token) ON public.stores FROM anon, authenticated, PUBLIC;

-- Re-grant SELECT on all other columns to keep storefronts working.
-- (Postgres column GRANTs are additive; once we revoke one column we must explicitly grant the rest.)
GRANT SELECT (
  id, owner_id, owner_email, name, slug, description, logo_url, banner_url,
  mobile_hero_url, mobile_hero_images, currency, whatsapp_number,
  instagram_url, facebook_url, order_mode, theme, features,
  best_selling_carousel, meta_title, meta_description, og_image_url,
  facebook_pixel_id, location, city, state, business_hours, custom_domain,
  return_policy, shipping_policy, is_suspended, is_verified, created_at,
  updated_at, about_us_text, about_us_image_url, partial_payment_enabled,
  partial_payment_type, partial_payment_value
) ON public.stores TO anon, authenticated;