DROP FUNCTION IF EXISTS public.get_store_leads_page(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.get_store_leads_page(_store_id uuid, _page integer DEFAULT 1, _page_size integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _size integer := LEAST(GREATEST(COALESCE(_page_size, 20), 1), 100);
  _offset integer := (GREATEST(COALESCE(_page, 1), 1) - 1) * LEAST(GREATEST(COALESCE(_page_size, 20), 1), 100);
  _result jsonb;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  WITH
  lead_rows AS (
    SELECT l.id::text AS id, l.name, l.phone, l.product_name, l.product_id::text AS product_id,
           l.source, l.created_at, false AS is_cart,
           right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 10) AS k
    FROM customer_leads l
    WHERE l.store_id = _store_id
  ),
  cart_rows AS (
    SELECT 'cart:' || c.id::text AS id, NULL::text AS name, c.customer_phone AS phone,
           CASE WHEN nullif(c.cart_items->0->>'name', '') IS NOT NULL THEN
             (c.cart_items->0->>'name') ||
             CASE WHEN jsonb_typeof(c.cart_items) = 'array' AND jsonb_array_length(c.cart_items) > 1
                  THEN ' +' || (jsonb_array_length(c.cart_items) - 1)::text ELSE '' END
           END AS product_name,
           nullif(c.cart_items->0->>'productId', '') AS product_id,
           'abandoned_cart'::text AS source, c.created_at, true AS is_cart,
           right(regexp_replace(c.customer_phone, '\D', '', 'g'), 10) AS k
    FROM abandoned_carts c
    WHERE c.store_id = _store_id
      AND c.recovered = false
      AND regexp_replace(coalesce(c.customer_phone, ''), '\D', '', 'g') <> ''
  ),
  combined AS (
    SELECT * FROM lead_rows
    UNION ALL
    SELECT cr.* FROM cart_rows cr
    WHERE NOT EXISTS (
      SELECT 1 FROM lead_rows lr
      WHERE lr.k = cr.k
        AND lr.created_at BETWEEN cr.created_at - interval '5 minutes' AND cr.created_at + interval '5 minutes'
    )
  ),
  purchased AS (
    SELECT right(regexp_replace(o.customer_phone, '\D', '', 'g'), 10) AS k, o.created_at
    FROM orders o
    WHERE o.store_id = _store_id
      AND o.status IN ('confirmed', 'shipped', 'delivered')
      AND length(regexp_replace(coalesce(o.customer_phone, ''), '\D', '', 'g')) >= 10
  ),
  visible AS (
    SELECT c.* FROM combined c
    WHERE NOT (
      length(c.k) = 10 AND EXISTS (
        SELECT 1 FROM purchased p
        WHERE p.k = c.k
          AND p.created_at >= c.created_at
          AND p.created_at <= c.created_at + interval '30 minutes'
      )
    )
  ),
  total AS (SELECT count(*)::integer AS n FROM visible),
  page_rows AS (
    SELECT v.* FROM visible v
    ORDER BY v.created_at DESC, v.id DESC
    LIMIT _size OFFSET _offset
  ),
  page_keys AS (
    SELECT DISTINCT k FROM page_rows WHERE length(k) = 10
  ),
  cart_products AS (
    SELECT DISTINCT ON (x.k) x.k, x.product_name, x.product_id
    FROM (
      SELECT right(regexp_replace(c.customer_phone, '\D', '', 'g'), 10) AS k,
             CASE WHEN nullif(c.cart_items->0->>'name', '') IS NOT NULL THEN
               (c.cart_items->0->>'name') ||
               CASE WHEN jsonb_typeof(c.cart_items) = 'array' AND jsonb_array_length(c.cart_items) > 1
                    THEN ' +' || (jsonb_array_length(c.cart_items) - 1)::text ELSE '' END
             END AS product_name,
             nullif(c.cart_items->0->>'productId', '') AS product_id,
             c.created_at
      FROM abandoned_carts c
      WHERE c.store_id = _store_id
        AND (SELECT count(*) FROM page_keys) > 0
    ) x
    WHERE x.k IN (SELECT k FROM page_keys)
      AND (x.product_name IS NOT NULL OR x.product_id IS NOT NULL)
    ORDER BY x.k, x.created_at DESC
  ),
  enriched AS (
    SELECT pr.id, pr.name, pr.phone, pr.source, pr.created_at, pr.is_cart,
           coalesce(pr.product_name, cp.product_name) AS product_name,
           coalesce(pr.product_id, cp.product_id) AS product_id
    FROM page_rows pr
    LEFT JOIN cart_products cp ON length(pr.k) = 10 AND cp.k = pr.k
  )
  SELECT jsonb_build_object(
    'total', (SELECT n FROM total),
    'rows', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'name', e.name,
        'phone', e.phone,
        'product_name', e.product_name,
        'product_id', e.product_id,
        'product_slug', p.slug,
        'source', e.source,
        'created_at', e.created_at,
        'is_cart', e.is_cart
      ) ORDER BY e.created_at DESC, e.id DESC)
      FROM enriched e
      LEFT JOIN products p
        ON e.product_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND p.id = e.product_id::uuid
       AND p.store_id = _store_id
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_store_leads_page(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_leads_page(uuid, integer, integer) TO authenticated, service_role;