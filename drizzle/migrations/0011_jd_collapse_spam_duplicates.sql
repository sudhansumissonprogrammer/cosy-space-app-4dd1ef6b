CREATE OR REPLACE FUNCTION public.jd_collapse_spam_duplicates(_store_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  -- Spam = more than 10 listings with identical title, price, sale price and photo.
  -- Keep one (ordered/in-stock/newest first); different suppliers with any difference are kept.
  WITH g AS (
    SELECT p.id, p.source_id,
      count(*) OVER w AS cnt,
      row_number() OVER (w ORDER BY EXISTS(SELECT 1 FROM order_items oi WHERE oi.product_id=p.id) DESC, (p.stock_quantity>0) DESC, p.created_at DESC) rn
    FROM products p WHERE p.store_id=_store_id AND p.source_platform='jdwebship'
    WINDOW w AS (PARTITION BY lower(trim(p.name)), p.price, p.sale_price, p.image_url)
  ), del AS (
    DELETE FROM products p USING g WHERE p.id=g.id AND g.cnt>10 AND g.rn>1
      AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.product_id=p.id)
    RETURNING p.source_id
  ), upd AS (
    UPDATE jd_sync_state j SET extra_cursor = coalesce(j.extra_cursor,'{}'::jsonb) || jsonb_build_object('__skip',
      coalesce(j.extra_cursor->'__skip','[]'::jsonb) || coalesce((SELECT jsonb_agg(source_id) FROM del WHERE source_id IS NOT NULL),'[]'::jsonb))
    WHERE j.store_id=_store_id AND EXISTS (SELECT 1 FROM del) RETURNING 1
  ) SELECT count(*) INTO _n FROM del;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.jd_collapse_spam_duplicates(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jd_collapse_spam_duplicates(uuid) TO service_role;