CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;

-- Weighted full-text column for products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(category, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(sku, '')), 'C') ||
    setweight(to_tsvector('simple', left(coalesce(description, ''), 4000)), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS products_search_tsv_idx ON public.products USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON public.products USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS products_category_trgm_idx ON public.products USING gin (category gin_trgm_ops);

DROP FUNCTION IF EXISTS public.search_products(uuid, text, integer, integer, text, numeric, numeric, text);

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
    btrim(coalesce(p_query, '')) AS q,
    least(greatest(coalesce(p_limit, 24), 1), 100) AS lim,
    greatest(coalesce(p_offset, 0), 0) AS off
),
toks AS (
  SELECT array_remove(
           array(
             SELECT lower(t)
             FROM regexp_split_to_table((SELECT q FROM params), '[^[:alnum:]]+') AS t
             WHERE length(t) > 0
           ), NULL) AS words
),
tsq AS (
  SELECT CASE
    WHEN array_length((SELECT words FROM toks), 1) IS NULL THEN NULL
    ELSE to_tsquery('simple',
      array_to_string(
        ARRAY(SELECT quote_literal(w) || ':*' FROM unnest((SELECT words FROM toks)) w),
        ' & '))
  END AS tq
),
base AS (
  SELECT p.*
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
      -- exact phrase in name
      CASE WHEN (SELECT q FROM params) <> ''
                AND lower(b.name) LIKE '%' || lower((SELECT q FROM params)) || '%'
           THEN 6.0 ELSE 0 END
      -- name starts with the query
      + CASE WHEN (SELECT q FROM params) <> ''
                  AND lower(b.name) LIKE lower((SELECT q FROM params)) || '%'
             THEN 3.0 ELSE 0 END
      -- full-text (all words, prefix-matched) with field weights
      + CASE WHEN (SELECT tq FROM tsq) IS NOT NULL AND b.search_tsv @@ (SELECT tq FROM tsq)
             THEN 4.0 + 8.0 * ts_rank(b.search_tsv, (SELECT tq FROM tsq))
             ELSE 0 END
      -- fuzzy / typo tolerance on name + category
      + 4.0 * greatest(
          similarity(lower(b.name), lower((SELECT q FROM params))),
          word_similarity(lower((SELECT q FROM params)), lower(b.name)),
          similarity(lower(coalesce(b.category, '')), lower((SELECT q FROM params))) * 0.8
        )
      -- sku exact
      + CASE WHEN (SELECT q FROM params) <> '' AND lower(coalesce(b.sku, '')) = lower((SELECT q FROM params))
             THEN 8.0 ELSE 0 END
      -- business boosts
      + CASE WHEN coalesce(b.stock_quantity, 0) > 0 THEN 0.6 ELSE 0 END
      + CASE WHEN b.is_best_selling THEN 0.5 ELSE 0 END
      + CASE WHEN coalesce(b.image_url, '') <> '' THEN 0.3 ELSE 0 END
    )::real AS score
  FROM base b
),
filtered AS (
  SELECT * FROM scored
  WHERE (SELECT q FROM params) = '' OR score >= 1.2
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

DROP FUNCTION IF EXISTS public.search_suggest_terms(uuid, text, integer);

CREATE OR REPLACE FUNCTION public.search_suggest_terms(
  p_store_id uuid,
  p_query text DEFAULT '',
  p_limit integer DEFAULT 6
)
RETURNS TABLE (term text, kind text, hits bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.category AS term, 'category'::text AS kind, count(*) AS hits
  FROM public.products c
  WHERE c.store_id = p_store_id
    AND c.is_active = true
    AND c.category IS NOT NULL AND c.category <> ''
    AND (
      btrim(coalesce(p_query, '')) = ''
      OR lower(c.category) LIKE '%' || lower(btrim(p_query)) || '%'
      OR similarity(lower(c.category), lower(btrim(p_query))) > 0.3
    )
  GROUP BY c.category
  ORDER BY hits DESC
  LIMIT least(greatest(coalesce(p_limit, 6), 1), 20);
$$;

GRANT EXECUTE ON FUNCTION public.search_suggest_terms(uuid, text, integer) TO anon, authenticated;