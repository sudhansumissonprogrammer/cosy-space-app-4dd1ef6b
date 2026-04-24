-- Tier 4 #13: Weekly media_library orphan cleanup
-- Safe: only deletes DB rows whose file_url is not referenced anywhere AND row is >7 days old.
-- Storage files are NOT touched — pure DB hygiene only.

CREATE OR REPLACE FUNCTION public.cleanup_orphan_media_library()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_count integer;
BEGIN
  WITH referenced AS (
    SELECT image_url AS url FROM public.products  WHERE image_url IS NOT NULL
    UNION ALL
    SELECT image_url        FROM public.product_images
    UNION ALL
    SELECT image_url        FROM public.categories WHERE image_url IS NOT NULL
    UNION ALL
    SELECT logo_url            FROM public.stores WHERE logo_url IS NOT NULL
    UNION ALL
    SELECT banner_url          FROM public.stores WHERE banner_url IS NOT NULL
    UNION ALL
    SELECT mobile_hero_url     FROM public.stores WHERE mobile_hero_url IS NOT NULL
    UNION ALL
    SELECT og_image_url        FROM public.stores WHERE og_image_url IS NOT NULL
    UNION ALL
    SELECT about_us_image_url  FROM public.stores WHERE about_us_image_url IS NOT NULL
  ),
  deleted AS (
    DELETE FROM public.media_library m
    WHERE m.created_at < now() - INTERVAL '7 days'
      AND NOT EXISTS (SELECT 1 FROM referenced r WHERE r.url = m.file_url)
    RETURNING 1
  )
  SELECT COUNT(*) INTO _deleted_count FROM deleted;

  RETURN json_build_object(
    'deleted_rows', _deleted_count,
    'ran_at', now()
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_orphan_media_library() FROM anon, authenticated;
