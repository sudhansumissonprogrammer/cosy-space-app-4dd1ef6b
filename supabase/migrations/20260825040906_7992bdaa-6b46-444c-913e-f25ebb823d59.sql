CREATE OR REPLACE FUNCTION public.get_store_apps_state(_store_slug text)
RETURNS TABLE(app_id text, config jsonb, enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.app_id, sa.config, sa.enabled
  FROM public.store_apps sa
  JOIN public.stores s ON s.id = sa.store_id
  WHERE s.slug = _store_slug;
$$;

REVOKE ALL ON FUNCTION public.get_store_apps_state(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_store_apps_state(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_category_products_page_by_slug(_store_id uuid, _category_slug text, _offset integer DEFAULT 0, _limit integer DEFAULT 24)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _category_id uuid;
  _category_name text;
  _rows json;
BEGIN
  SELECT id, name INTO _category_id, _category_name
    FROM categories
   WHERE store_id = _store_id AND slug = _category_slug AND is_hidden = false
   LIMIT 1;

  IF _category_name IS NULL THEN
    RETURN '[]'::json;
  END IF;

  SELECT COALESCE(json_agg(p ORDER BY p.is_category_pinned DESC, p.category_pinned_at DESC NULLS LAST, p.display_order ASC, p.created_at DESC), '[]'::json)
    INTO _rows FROM (
    SELECT id, store_id, name, description, price, currency, sku, stock_quantity,
           is_active, image_url, slug, sale_price, category, is_best_selling,
           is_category_pinned, category_pinned_at, video_url, video_poster_url,
           display_order, created_at, updated_at
    FROM products pr
    WHERE pr.store_id = _store_id AND pr.is_active = true AND pr.hidden_by_category = false
      AND (lower(pr.category) = lower(_category_name)
           OR EXISTS (
                 SELECT 1 FROM product_categories pc
                  WHERE pc.product_id = pr.id AND pc.category_id = _category_id))
    ORDER BY is_category_pinned DESC, category_pinned_at DESC NULLS LAST, display_order ASC, created_at DESC
    OFFSET GREATEST(_offset, 0) LIMIT GREATEST(_limit, 1)
  ) p;

  RETURN _rows;
END;
$$;

REVOKE ALL ON FUNCTION public.get_category_products_page_by_slug(uuid, text, integer, integer) FROM public;
GRANT EXECUTE ON FUNCTION public.get_category_products_page_by_slug(uuid, text, integer, integer) TO anon, authenticated, service_role;