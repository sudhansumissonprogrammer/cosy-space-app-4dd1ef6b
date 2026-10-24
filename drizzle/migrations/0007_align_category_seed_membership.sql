CREATE OR REPLACE FUNCTION public.get_category_page(_store_slug text, _category_slug text, _limit integer DEFAULT 24)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _store_id uuid; _category json; _category_id uuid; _category_name text; _products json; _total int;
BEGIN
  SELECT id INTO _store_id FROM stores WHERE slug = _store_slug AND is_suspended = false LIMIT 1;
  IF _store_id IS NULL THEN RETURN json_build_object('category', null, 'products', '[]'::json, 'total', 0); END IF;
  SELECT row_to_json(c), c.name, c.id INTO _category, _category_name, _category_id FROM (
    SELECT id, store_id, name, slug, image_url, display_order, show_on_home, created_at, meta_title, meta_description, og_image_url
    FROM categories WHERE store_id = _store_id AND slug = _category_slug AND is_hidden = false LIMIT 1
  ) c;
  IF _category IS NULL THEN RETURN json_build_object('category', null, 'products', '[]'::json, 'total', 0); END IF;
  SELECT COUNT(*) INTO _total FROM products p
  WHERE p.store_id = _store_id AND p.is_active = true AND p.hidden_by_category = false
    AND (lower(p.category) = lower(_category_name) OR EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.id AND pc.category_id = _category_id));
  SELECT COALESCE(json_agg(p ORDER BY p.is_category_pinned DESC, p.category_pinned_at DESC NULLS LAST, p.display_order ASC, p.created_at DESC, p.id ASC), '[]'::json) INTO _products FROM (
    SELECT id, store_id, name, description, price, currency, sku, stock_quantity, is_active, image_url, slug, sale_price, category, is_best_selling, is_category_pinned, category_pinned_at, display_order, created_at, updated_at
    FROM products pr
    WHERE pr.store_id = _store_id AND pr.is_active = true AND pr.hidden_by_category = false
      AND (lower(pr.category) = lower(_category_name) OR EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = pr.id AND pc.category_id = _category_id))
    ORDER BY is_category_pinned DESC, category_pinned_at DESC NULLS LAST, display_order ASC, created_at DESC, id ASC
    LIMIT GREATEST(_limit, 1)
  ) p;
  RETURN json_build_object('category', _category, 'products', _products, 'total', _total);
END;
$function$;
REVOKE ALL ON FUNCTION public.get_category_page(text, text, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_category_page(text, text, integer) TO anon, authenticated, service_role;