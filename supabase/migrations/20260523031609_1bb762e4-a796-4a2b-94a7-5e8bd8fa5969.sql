REVOKE SELECT ON public.store_payment_config FROM anon, authenticated;
GRANT SELECT (id, store_id, payment_methods, razorpay_key_id, cashfree_app_id, cashfree_env, created_at, updated_at)
ON public.store_payment_config TO anon, authenticated;

REVOKE SELECT ON public.platform_config FROM anon, authenticated;
GRANT SELECT (id, platform_name, default_currency, wa_phone_number_id, wa_business_phone, created_at, updated_at)
ON public.platform_config TO anon, authenticated;

REVOKE SELECT ON public.whatsapp_config FROM anon, authenticated;
GRANT SELECT (id, store_id, phone_number_id, waba_id, business_phone, is_active, created_at, updated_at, marketing_mode)
ON public.whatsapp_config TO anon, authenticated;

REVOKE SELECT ON public.stores FROM anon, authenticated;
GRANT SELECT (
  id, owner_id, name, slug, description, logo_url, banner_url, currency,
  whatsapp_number, instagram_url, facebook_url, order_mode, theme, features,
  is_suspended, is_verified, created_at, updated_at, custom_domain,
  meta_title, meta_description, og_image_url, facebook_pixel_id, location,
  city, state, business_hours, return_policy, shipping_policy,
  best_selling_carousel, about_us_text, about_us_image_url,
  partial_payment_enabled, partial_payment_type, partial_payment_value,
  mobile_hero_url, mobile_hero_images, domain_verified
) ON public.stores TO anon, authenticated;

REVOKE SELECT ON public.email_unsubscribe_tokens FROM anon, authenticated;
REVOKE SELECT ON public.suppressed_emails FROM anon, authenticated;
REVOKE SELECT ON public.whatsapp_optouts FROM anon, authenticated;

REVOKE SELECT ON public.store_plan_assignments FROM anon, authenticated;
GRANT SELECT (
  id, store_id, plan_id, status, custom_price, is_free_lifetime, is_one_time,
  custom_product_limit, custom_plan_name, trial_ends_at, current_period_end,
  billing_status, last_payment_at, next_billing_amount, grace_period_ends_at,
  created_at, updated_at
) ON public.store_plan_assignments TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_own_payment_secret(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_own_cashfree_secret(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_own_store_meta_token(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_own_domain_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_own_payment_secret(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_cashfree_secret(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_store_meta_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_own_domain_token(uuid) TO authenticated;