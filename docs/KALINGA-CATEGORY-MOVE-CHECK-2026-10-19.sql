-- Read-only checks: insert former positions 66/67 at 11/12, never swap.
WITH ranked AS (
  SELECT p.id, row_number() OVER (
    ORDER BY p.is_category_pinned DESC, p.category_pinned_at DESC NULLS LAST,
      p.display_order ASC, p.created_at DESC, p.id ASC
  ) AS position
  FROM public.products p
  WHERE p.store_id = 'c3c5dff2-173a-4f4d-90e4-8b1c88c305d9'
    AND p.is_active AND NOT p.hidden_by_category
    AND (lower(p.category) = 'chain with pendant' OR EXISTS (
      SELECT 1 FROM public.product_categories pc
      WHERE pc.product_id = p.id
        AND pc.category_id = 'ccbe216e-9bc8-4b72-9ee3-3bd8a1cacce2'
    ))
)
SELECT
  bool_or(position = 11 AND id = 'a4a8b5d2-17bd-49a7-a0a5-97dde85ae724') AS former_66_now_11,
  bool_or(position = 12 AND id = 'd7090781-8754-45e2-98a4-542a2201e2ca') AS former_67_now_12,
  bool_or(position = 13 AND id = '6d347db6-ed2d-409e-8a21-635c7ed3da98') AS former_11_shifted_to_13,
  bool_or(position = 14 AND id = 'b9e91c5f-bdfa-457e-8c87-0fab57037a72') AS former_12_shifted_to_14,
  bool_or(position = 67 AND id = 'cbe122bf-bdd8-4044-a66f-a2926f57c75e') AS former_65_shifted_to_67,
  count(*) = 69 AS all_members_retained
FROM ranked;