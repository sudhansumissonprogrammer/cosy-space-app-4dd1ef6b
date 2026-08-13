ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS mobile_hero_video_url text,
  ADD COLUMN IF NOT EXISTS mobile_hero_video_poster text,
  ADD COLUMN IF NOT EXISTS desktop_hero_video_url text,
  ADD COLUMN IF NOT EXISTS desktop_hero_video_poster text;

CREATE OR REPLACE FUNCTION public.get_store_public(_slug text)
 RETURNS json
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT json_build_object(
    'id', s.id, 'name', s.name, 'slug', s.slug,
    'description', s.description, 'logo_url', s.logo_url,
    'banner_url', s.banner_url, 'mobile_hero_url', s.mobile_hero_url,
    'mobile_hero_images', s.mobile_hero_images, 'currency', s.currency,
    'mobile_hero_video_url', s.mobile_hero_video_url,
    'mobile_hero_video_poster', s.mobile_hero_video_poster,
    'desktop_hero_video_url', s.desktop_hero_video_url,
    'desktop_hero_video_poster', s.desktop_hero_video_poster,
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
$function$;