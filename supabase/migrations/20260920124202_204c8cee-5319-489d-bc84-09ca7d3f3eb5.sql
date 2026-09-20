CREATE OR REPLACE FUNCTION public.get_category_collage_urls(_category_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  WITH category_row AS (
    SELECT c.id, c.store_id, c.name
    FROM public.categories c
    WHERE c.id = _category_id
  ),
  selected AS (
    SELECT p.id, p.image_url, cfp.position::bigint AS rank
    FROM public.category_featured_products cfp
    JOIN category_row c ON c.id = cfp.category_id
    JOIN public.products p ON p.id = cfp.product_id
      AND p.store_id = c.store_id
      AND lower(trim(COALESCE(p.category, ''))) = lower(trim(c.name))
      AND p.is_active = true
      AND COALESCE(p.hidden_by_category, false) = false
    WHERE NULLIF(trim(COALESCE(p.image_url, '')), '') IS NOT NULL
  ),
  automatic AS (
    SELECT p.id, p.image_url,
      (4 + row_number() OVER (ORDER BY p.is_category_pinned DESC NULLS LAST, p.category_pinned_at DESC NULLS LAST, p.display_order, p.created_at DESC, p.id))::bigint AS rank
    FROM category_row c
    JOIN public.products p ON p.store_id = c.store_id
      AND lower(trim(COALESCE(p.category, ''))) = lower(trim(c.name))
      AND p.is_active = true
      AND COALESCE(p.hidden_by_category, false) = false
      AND NULLIF(trim(COALESCE(p.image_url, '')), '') IS NOT NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM public.category_featured_products cfp
      WHERE cfp.category_id = c.id AND cfp.product_id = p.id
    )
  ),
  resolved AS (
    SELECT id, image_url, rank FROM selected
    UNION ALL
    SELECT id, image_url, rank FROM automatic
  )
  SELECT COALESCE(jsonb_agg(image_url ORDER BY rank), '[]'::jsonb)
  FROM (SELECT image_url, rank FROM resolved ORDER BY rank LIMIT 4) four;
$$;

REVOKE ALL ON FUNCTION public.get_category_collage_urls(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_category_collage_urls(uuid) TO anon, authenticated, service_role;