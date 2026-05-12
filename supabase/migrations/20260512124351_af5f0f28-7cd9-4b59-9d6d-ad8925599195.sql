
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS meta_title text,
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image_url text;

CREATE OR REPLACE FUNCTION public.get_product_page(_store_slug text, _product_slug text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store_id uuid;
  _product json;
  _images json;
  _variants json;
  _shipping json;
BEGIN
  SELECT id INTO _store_id FROM stores WHERE slug = _store_slug AND is_suspended = false LIMIT 1;
  IF _store_id IS NULL THEN RETURN json_build_object('product', null); END IF;

  SELECT row_to_json(p) INTO _product FROM (
    SELECT id, store_id, name, description, price, currency, sku, stock_quantity,
           is_active, image_url, slug, sale_price, category, is_best_selling,
           cost_price, display_order, partial_payment_enabled,
           partial_payment_type, partial_payment_value, created_at, updated_at,
           meta_title, meta_description, og_image_url
    FROM products
    WHERE store_id = _store_id AND slug = _product_slug AND is_active = true
    LIMIT 1
  ) p;
  IF _product IS NULL THEN RETURN json_build_object('product', null); END IF;

  SELECT COALESCE(json_agg(i ORDER BY i.display_order), '[]'::json) INTO _images FROM (
    SELECT pi.id, pi.product_id, pi.image_url, pi.display_order
    FROM product_images pi
    WHERE pi.product_id = (_product->>'id')::uuid
    ORDER BY pi.display_order
  ) i;

  SELECT COALESCE(json_agg(v ORDER BY v.display_order), '[]'::json) INTO _variants FROM (
    SELECT pv.id, pv.product_id, pv.name, pv.sku, pv.price, pv.stock_quantity,
           pv.is_active, pv.display_order
    FROM product_variants pv
    WHERE pv.product_id = (_product->>'id')::uuid AND pv.is_active = true
    ORDER BY pv.display_order
  ) v;

  SELECT json_build_object(
    'free_shipping_above', sc.free_shipping_above,
    'flat_rate', sc.flat_rate,
    'is_active', sc.is_active
  ) INTO _shipping FROM store_shipping_config sc WHERE sc.store_id = _store_id LIMIT 1;

  RETURN json_build_object(
    'product', _product,
    'images', _images,
    'variants', _variants,
    'shipping_config', _shipping
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_category_page(_store_slug text, _category_slug text, _limit integer DEFAULT 24)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store_id uuid;
  _category json;
  _category_name text;
  _products json;
  _total int;
BEGIN
  SELECT id INTO _store_id FROM stores WHERE slug = _store_slug AND is_suspended = false LIMIT 1;
  IF _store_id IS NULL THEN
    RETURN json_build_object('category', null, 'products', '[]'::json, 'total', 0);
  END IF;

  SELECT row_to_json(c), c.name INTO _category, _category_name FROM (
    SELECT id, store_id, name, slug, image_url, display_order, show_on_home, created_at,
           meta_title, meta_description, og_image_url
    FROM categories
    WHERE store_id = _store_id AND slug = _category_slug
    LIMIT 1
  ) c;
  IF _category IS NULL THEN
    RETURN json_build_object('category', null, 'products', '[]'::json, 'total', 0);
  END IF;

  SELECT COUNT(*) INTO _total FROM products
  WHERE store_id = _store_id AND is_active = true AND category = _category_name;

  SELECT COALESCE(json_agg(p ORDER BY p.display_order, p.created_at DESC), '[]'::json) INTO _products FROM (
    SELECT id, store_id, name, description, price, currency, sku, stock_quantity,
           is_active, image_url, slug, sale_price, category, is_best_selling,
           display_order, created_at, updated_at
    FROM products
    WHERE store_id = _store_id AND is_active = true AND category = _category_name
    ORDER BY display_order, created_at DESC
    LIMIT GREATEST(_limit, 1)
  ) p;

  RETURN json_build_object(
    'category', _category,
    'products', _products,
    'total', _total
  );
END;
$function$;
