-- Table-level SELECT grants override column-level REVOKEs. Remove the table-level grant first.
REVOKE SELECT ON public.stores FROM anon, authenticated, PUBLIC;

-- Re-grant SELECT only on safe columns (everything EXCEPT meta_access_token + domain_verification_token).
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

-- Service role keeps full access for edge functions.
GRANT SELECT ON public.stores TO service_role;