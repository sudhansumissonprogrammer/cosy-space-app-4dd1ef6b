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
  _kept uuid[] := '{}'::uuid[];
  _last_key text := NULL;
  _last_kept timestamptz := NULL;
  _c record;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;

  -- Open carts become leads unless the same phone already has a lead within
  -- 5 minutes, or a newer kept cart within 5 minutes (newest cart wins).
  FOR _c IN
    SELECT c.id, c.created_at,
           right(regexp_replace(c.customer_phone, '\D', '', 'g'), 10) AS k
    FROM abandoned_carts c
    WHERE c.store_id = _store_id
      AND c.recovered = false
      AND regexp_replace(coalesce(c.customer_phone, ''), '\D', '', 'g') <> ''
      AND NOT EXISTS (
        SELECT 1 FROM customer_leads l
        WHERE l.store_id = _store_id
          AND l.created_at BETWEEN c.created_at - interval '5 minutes' AND c.created_at + interval '5 minutes'
          AND right(regexp_replace(coalesce(l.phone, ''), '\D', '', 'g'), 10)
              = right(regexp_replace(c.customer_phone, '\D', '', 'g'), 10)
      )
    ORDER BY 3, c.created_at DESC
  LOOP
    IF _last_key IS DISTINCT FROM _c.k THEN
      _last_key := _c.k;
      _last_kept := NULL;
    END IF;
    IF _last_kept IS NULL OR _last_kept - _c.created_at > interval '5 minutes' THEN
      _kept := _kept || _c.id;
      _last_kept := _c.created_at;
    END IF;
  END LOOP;

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
    WHERE c.id = ANY(_kept)
  ),
  combined AS (
    SELECT * FROM lead_rows
    UNION ALL
    SELECT * FROM cart_rows
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
  ),
  with_uuid AS (
    SELECT e.*,
           CASE WHEN e.product_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN e.product_id::uuid END AS product_uuid
    FROM enriched e
  )
  SELECT jsonb_build_object(
    'total', (SELECT n FROM total),
    'rows', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', w.id,
        'name', w.name,
        'phone', w.phone,
        'product_name', w.product_name,
        'product_id', w.product_id,
        'product_slug', p.slug,
        'source', w.source,
        'created_at', w.created_at,
        'is_cart', w.is_cart
      ) ORDER BY w.created_at DESC, w.id DESC)
      FROM with_uuid w
      LEFT JOIN products p ON p.id = w.product_uuid AND p.store_id = _store_id
    ), '[]'::jsonb)
  ) INTO _result;

  RETURN _result;
END;
$function$;