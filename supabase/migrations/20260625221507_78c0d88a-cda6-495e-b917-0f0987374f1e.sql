
-- =========================================================
-- 1) products.cost_price — hide from anon (public shoppers)
-- =========================================================
-- anon currently has table-wide SELECT which exposes cost_price (profit margin leak).
-- Revoke table grant and re-grant all NON-sensitive columns explicitly.
REVOKE SELECT ON public.products FROM anon;
GRANT SELECT (
  id, store_id, name, description, price, currency, sku, stock_quantity,
  is_active, image_url, created_at, updated_at, slug, sale_price, category,
  is_best_selling, display_order, partial_payment_enabled, partial_payment_type,
  partial_payment_value, meta_title, meta_description, og_image_url, image_alt,
  is_category_pinned, category_pinned_at, has_variants, video_url, video_poster_url
) ON public.products TO anon;

-- authenticated keeps full access (owners need cost_price for margin reporting)
-- No change needed there.

-- =========================================================
-- 2) stores.meta_access_token — hide from authenticated
-- =========================================================
-- Owners write it via UPDATE (which is unaffected — UPDATE grants are separate).
-- Edge functions read it via service_role (RLS-bypassing). Frontend never needs it.
REVOKE SELECT ON public.stores FROM authenticated;
GRANT SELECT (
  id, owner_id, name, slug, description, logo_url, created_at, updated_at,
  whatsapp_number, banner_url, is_suspended, business_hours, location, is_verified,
  city, state, currency, instagram_url, facebook_url, order_mode, theme, features,
  custom_domain, return_policy, shipping_policy, best_selling_carousel,
  mobile_hero_url, facebook_pixel_id, meta_title, meta_description, og_image_url,
  owner_email, mobile_hero_images, default_profit_margin,
  domain_verification_token, domain_verified, about_us_text, about_us_image_url,
  partial_payment_enabled, partial_payment_type, partial_payment_value,
  suspension_reason, referred_by_partner_id, billing_mode, seo_about_paragraph,
  faq_items, usp_bullets, timezone, analytics_retention_days, secondary_phone
) ON public.stores TO authenticated;

-- anon already restricted by an earlier migration; leave as-is.

-- =========================================================
-- 3) push_subscriptions credentials — hide p256dh & auth keys
-- =========================================================
-- Owners need id/endpoint/device_label/enabled/last_used_at for the device list
-- and to identify "this device". p256dh & auth are Web Push crypto keys —
-- only the server-side sender (service_role) needs them.
REVOKE SELECT ON public.push_subscriptions FROM authenticated;
GRANT SELECT (
  id, store_id, endpoint, created_at, user_id, device_label,
  user_agent, enabled, sound_enabled, last_used_at
) ON public.push_subscriptions TO authenticated;
-- INSERT/UPDATE/DELETE grants are unaffected (owners still register & disable devices).
