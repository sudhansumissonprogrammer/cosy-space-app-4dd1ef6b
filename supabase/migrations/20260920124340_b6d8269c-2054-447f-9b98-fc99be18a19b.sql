CREATE OR REPLACE FUNCTION public.get_storefront_categories(_store_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    jsonb_agg(to_jsonb(c) || jsonb_build_object('collage_image_urls', public.get_category_collage_urls(c.id)) ORDER BY c.display_order, c.name),
    '[]'::jsonb
  )
  FROM public.categories c
  WHERE c.store_id = _store_id AND c.is_hidden = false;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_categories(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_categories(uuid) TO anon, authenticated, service_role;