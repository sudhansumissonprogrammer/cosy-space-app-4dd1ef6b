-- Layer 5: merchant-editable SEO fields
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS seo_about_paragraph text,
  ADD COLUMN IF NOT EXISTS faq_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usp_bullets text[] NOT NULL DEFAULT '{}';

-- SEO RPC used by worker for /llms.txt, /sitemap.xml, and bot-rendered pages.
-- Returns store + categories + up to 200 products + faq/usp/about in one round-trip.
CREATE OR REPLACE FUNCTION public.get_storefront_seo(_slug text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store stores%ROWTYPE;
  _categories json;
  _products json;
  _result json;
BEGIN
  SELECT * INTO _store FROM stores WHERE slug = _slug LIMIT 1;
  IF _store.id IS NULL OR COALESCE(_store.is_suspended, false) THEN
    RETURN json_build_object('store', null);
  END IF;

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'name', c.name,
        'slug', c.slug,
        'image_url', c.image_url,
        'product_count', (
          SELECT count(*) FROM products p
          WHERE p.store_id = _store.id AND p.is_active = true AND p.category = c.name
        )
      ) ORDER BY c.display_order, c.name
    ), '[]'::json
  ) INTO _categories
  FROM categories c WHERE c.store_id = _store.id;

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'name', p.name,
        'slug', p.slug,
        'price', p.price,
        'sale_price', p.sale_price,
        'currency', p.currency,
        'image_url', p.image_url,
        'category', p.category,
        'description', p.description,
        'stock_quantity', p.stock_quantity,
        'updated_at', p.updated_at
      ) ORDER BY p.is_best_selling DESC NULLS LAST, p.display_order, p.created_at DESC
    ), '[]'::json
  ) INTO _products
  FROM (
    SELECT *
    FROM products
    WHERE store_id = _store.id AND is_active = true
    ORDER BY is_best_selling DESC NULLS LAST, display_order, created_at DESC
    LIMIT 200
  ) p;

  RETURN json_build_object(
    'store', json_build_object(
      'id', _store.id,
      'name', _store.name,
      'slug', _store.slug,
      'description', _store.description,
      'logo_url', _store.logo_url,
      'banner_url', _store.banner_url,
      'og_image_url', _store.og_image_url,
      'currency', _store.currency,
      'whatsapp_number', _store.whatsapp_number,
      'instagram_url', _store.instagram_url,
      'facebook_url', _store.facebook_url,
      'location', _store.location,
      'city', _store.city,
      'state', _store.state,
      'business_hours', _store.business_hours,
      'custom_domain', _store.custom_domain,
      'meta_title', _store.meta_title,
      'meta_description', _store.meta_description,
      'about_us_text', _store.about_us_text,
      'return_policy', _store.return_policy,
      'shipping_policy', _store.shipping_policy,
      'seo_about_paragraph', _store.seo_about_paragraph,
      'faq_items', _store.faq_items,
      'usp_bullets', _store.usp_bullets,
      'updated_at', _store.updated_at
    ),
    'categories', _categories,
    'products', _products
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_storefront_seo(text) TO anon, authenticated, service_role;