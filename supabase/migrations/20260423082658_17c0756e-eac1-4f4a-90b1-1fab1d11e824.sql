WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY display_order ASC, created_at DESC) AS rn,
         COUNT(*) OVER () AS total
  FROM public.products
  WHERE store_id = 'c3c5dff2-173a-4f4d-90e4-8b1c88c305d9'
    AND is_best_selling = true
)
UPDATE public.products p
SET display_order = (ranked.total - ranked.rn)
FROM ranked
WHERE p.id = ranked.id;