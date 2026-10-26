CREATE OR REPLACE FUNCTION public.jd_organize_watch_catalog(_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _dated int; _linked int;
BEGIN
  UPDATE products SET created_at = to_timestamp(substr(source_id,4,10)::bigint), display_order = 0
  WHERE store_id = _store_id AND source_platform = 'jdwebship' AND source_id ~ '^SKU\d{10}'
    AND (created_at <> to_timestamp(substr(source_id,4,10)::bigint) OR display_order <> 0);
  GET DIAGNOSTICS _dated = ROW_COUNT;

  WITH base AS (
    SELECT id, regexp_replace(lower((regexp_match(name,'^(.+?) Watch (Men|Women)$'))[1]),'[^a-z]','','g') AS key,
           (regexp_match(name,'^(.+?) Watch (Men|Women)$'))[2] AS gender
    FROM categories WHERE store_id = _store_id AND name ~ '^.+ Watch (Men|Women)$'
  ), aliases(alias, key) AS (VALUES
    ('tagheur','tagheuer'),('tagh','tagheuer'),('patek','patekphilippe'),('raddo','rado'),('bvlgary','bvlgari'),
    ('bulgari','bvlgari'),('michal','michaelkors'),('michaelk','michaelkors'),('fosil','fossil'),('calvin','calvinklein'),
    ('cosmograph','rolex'),('rolexx','rolex'),('swarovsk','swarovski'),('sevenfriday','sevenfriday'),('gshock','gshock')
  ), brands AS (
    SELECT id, key, gender FROM base
    UNION SELECT b.id, a.alias, b.gender FROM base b JOIN aliases a ON a.key = b.key
  ), todo AS (
    SELECT p.id, regexp_replace(lower(p.name),'[^a-z]','','g') AS nk,
           CASE WHEN p.category = 'Women''s - Watch' THEN 'Women' ELSE 'Men' END AS gender
    FROM products p
    WHERE p.store_id = _store_id AND p.category ILIKE '%watch%'
      AND NOT EXISTS (SELECT 1 FROM product_categories pc JOIN base b ON b.id = pc.category_id WHERE pc.product_id = p.id)
  ), matched AS (
    -- Prefer same gender; fall back to the brand's only category when that gender has none.
    SELECT DISTINCT ON (t.id, b.key) t.id AS pid, b.id AS cid
    FROM todo t JOIN brands b ON length(b.key) >= 3 AND t.nk LIKE '%' || b.key || '%'
    ORDER BY t.id, b.key, (b.gender = t.gender) DESC
  ), ins AS (
    INSERT INTO product_categories (product_id, category_id, store_id, is_primary)
    SELECT pid, cid, _store_id, false FROM matched
    ON CONFLICT DO NOTHING RETURNING 1
  ) SELECT count(*) INTO _linked FROM ins;

  RETURN jsonb_build_object('dated', _dated, 'brand_links', _linked);
END $$;
REVOKE ALL ON FUNCTION public.jd_organize_watch_catalog(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jd_organize_watch_catalog(uuid) TO service_role;