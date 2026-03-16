
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS mobile_hero_images jsonb DEFAULT NULL;

-- Update get_storefront_data to include mobile_hero_images
CREATE OR REPLACE FUNCTION public.get_storefront_data(_slug text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store stores%ROWTYPE;
  _products json;
  _categories json;
  _theme_config json;
  _store_json json;
BEGIN
  SELECT * INTO _store FROM stores WHERE slug = _slug LIMIT 1;
  IF _store.id IS NULL THEN
    RETURN json_build_object('store', null, 'products', '[]'::json, 'categories', '[]'::json, 'theme_config', null);
  END IF;

  SELECT COALESCE(json_agg(p ORDER BY p.created_at DESC), '[]'::json)
  INTO _products
  FROM products p
  WHERE p.store_id = _store.id AND p.is_active = true;

  SELECT COALESCE(json_agg(c ORDER BY c.name), '[]'::json)
  INTO _categories
  FROM categories c
  WHERE c.store_id = _store.id;

  SELECT row_to_json(tc) INTO _theme_config
  FROM store_theme_config tc
  WHERE tc.store_id = _store.id;

  SELECT json_build_object(
    'id', _store.id,
    'name', _store.name,
    'slug', _store.slug,
    'description', _store.description,
    'logo_url', _store.logo_url,
    'banner_url', _store.banner_url,
    'mobile_hero_url', _store.mobile_hero_url,
    'mobile_hero_images', _store.mobile_hero_images,
    'currency', _store.currency,
    'whatsapp_number', _store.whatsapp_number,
    'instagram_url', _store.instagram_url,
    'facebook_url', _store.facebook_url,
    'order_mode', _store.order_mode,
    'theme', _store.theme,
    'features', _store.features,
    'best_selling_carousel', _store.best_selling_carousel,
    'meta_title', _store.meta_title,
    'meta_description', _store.meta_description,
    'og_image_url', _store.og_image_url,
    'facebook_pixel_id', _store.facebook_pixel_id,
    'location', _store.location,
    'city', _store.city,
    'state', _store.state,
    'business_hours', _store.business_hours,
    'custom_domain', _store.custom_domain,
    'return_policy', _store.return_policy,
    'shipping_policy', _store.shipping_policy,
    'is_suspended', _store.is_suspended,
    'is_verified', _store.is_verified,
    'created_at', _store.created_at,
    'updated_at', _store.updated_at
  ) INTO _store_json;

  RETURN json_build_object(
    'store', _store_json,
    'products', _products,
    'categories', _categories,
    'theme_config', _theme_config
  );
END;
$function$;
