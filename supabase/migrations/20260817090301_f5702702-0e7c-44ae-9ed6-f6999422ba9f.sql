CREATE OR REPLACE FUNCTION public.search_products(
  p_store_id uuid,
  p_query text DEFAULT '',
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0,
  p_sort text DEFAULT 'relevance',
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  price numeric,
  sale_price numeric,
  image_url text,
  category text,
  stock_quantity integer,
  is_best_selling boolean,
  sku text,
  currency text,
  created_at timestamptz,
  score real,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH params AS (
  SELECT
    lower(btrim(coalesce(p_query, ''))) AS q,
    least(greatest(coalesce(p_limit, 24), 1), 100) AS lim,
    greatest(coalesce(p_offset, 0), 0) AS off
),
toks AS (
  SELECT array(
    SELECT lower(t)
    FROM regexp_split_to_table((SELECT q FROM params), '[^[:alnum:]]+') AS t
    WHERE length(t) > 0
  ) AS words
),
tsq AS (
  SELECT CASE
    WHEN coalesce(array_length((SELECT words FROM toks), 1), 0) = 0 THEN NULL
    ELSE to_tsquery('simple',
      array_to_string(
        ARRAY(SELECT quote_literal(w) || ':*' FROM unnest((SELECT words FROM toks)) w),
        ' & '))
  END AS tq
),
base AS (
  SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.image_url, p.category,
         p.stock_quantity, p.is_best_selling, p.sku, p.currency, p.created_at,
         p.search_tsv
  FROM public.products p
  WHERE p.store_id = p_store_id
    AND p.is_active = true
    AND (p_category IS NULL OR lower(p.category) = lower(p_category))
    AND (p_min_price IS NULL OR coalesce(p.sale_price, p.price) >= p_min_price)
    AND (p_max_price IS NULL OR coalesce(p.sale_price, p.price) <= p_max_price)
),
scored AS (
  SELECT b.*,
    (
      CASE WHEN (SELECT q FROM params) <> '' AND lower(b.name) LIKE '%' || (SELECT q FROM params) || '%'
           THEN 6.0 ELSE 0 END
      + CASE WHEN (SELECT q FROM params) <> '' AND lower(b.name) LIKE (SELECT q FROM params) || '%'
             THEN 3.0 ELSE 0 END
      + CASE WHEN (SELECT tq FROM tsq) IS NOT NULL AND b.search_tsv @@ (SELECT tq FROM tsq)
             THEN 4.0 + 8.0 * ts_rank(b.search_tsv, (SELECT tq FROM tsq))
             ELSE 0 END
      + CASE WHEN (SELECT q FROM params) <> '' AND lower(coalesce(b.sku, '')) = (SELECT q FROM params)
             THEN 8.0 ELSE 0 END
      + 7.0 * coalesce(tok.avg_sim, 0)
    )::real AS match_score
  FROM base b
  LEFT JOIN LATERAL (
    SELECT avg(
      greatest(
        CASE WHEN lower(b.name) LIKE '%' || w || '%' THEN 1.0 ELSE 0 END,
        CASE WHEN lower(coalesce(b.category, '')) LIKE '%' || w || '%' THEN 0.85 ELSE 0 END,
        word_similarity(w, lower(b.name)),
        similarity(w, lower(coalesce(b.category, ''))) * 0.7
      )
    ) AS avg_sim
    FROM unnest((SELECT words FROM toks)) AS w
  ) tok ON true
),
filtered AS (
  SELECT s.*,
    (s.match_score
      + CASE WHEN coalesce(s.stock_quantity, 0) > 0 THEN 0.6 ELSE 0 END
      + CASE WHEN s.is_best_selling THEN 0.5 ELSE 0 END
      + CASE WHEN coalesce(s.image_url, '') <> '' THEN 0.3 ELSE 0 END
    )::real AS score
  FROM scored s
  WHERE (SELECT q FROM params) = '' OR s.match_score >= 2.0
),
counted AS (
  SELECT f.*, count(*) OVER () AS total_count FROM filtered f
)
SELECT c.id, c.name, c.slug, c.price, c.sale_price, c.image_url, c.category,
       c.stock_quantity, c.is_best_selling, c.sku, c.currency, c.created_at,
       c.score, c.total_count
FROM counted c
ORDER BY
  CASE WHEN p_sort = 'price_asc'  THEN coalesce(c.sale_price, c.price) END ASC NULLS LAST,
  CASE WHEN p_sort = 'price_desc' THEN coalesce(c.sale_price, c.price) END DESC NULLS LAST,
  CASE WHEN p_sort = 'newest'     THEN c.created_at END DESC NULLS LAST,
  CASE WHEN p_sort NOT IN ('price_asc','price_desc','newest') THEN c.score END DESC NULLS LAST,
  c.created_at DESC,
  c.id
LIMIT (SELECT lim FROM params) OFFSET (SELECT off FROM params);
$$;

GRANT EXECUTE ON FUNCTION public.search_products(uuid, text, integer, integer, text, numeric, numeric, text) TO anon, authenticated;