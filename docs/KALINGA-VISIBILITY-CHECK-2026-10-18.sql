-- Read-only regression checks for the requested temporary visibility rule.
WITH membership AS (
  SELECT p.*,
    lower(trim(coalesce(p.category, ''))) = 'chain with pendant'
    OR EXISTS (
      SELECT 1 FROM public.product_categories pc
      WHERE pc.product_id = p.id AND pc.store_id = p.store_id
        AND pc.category_id = 'ccbe216e-9bc8-4b72-9ee3-3bd8a1cacce2'
    ) AS keep
  FROM public.products p
  WHERE p.store_id = 'c3c5dff2-173a-4f4d-90e4-8b1c88c305d9'
)
SELECT
  count(*) FILTER (WHERE keep) > 0
    AND count(*) FILTER (WHERE keep AND (NOT is_active OR hidden_by_category)) = 0
    AS all_chain_members_visible,
  count(*) FILTER (WHERE NOT keep) > 0
    AND count(*) FILTER (WHERE NOT keep AND is_active) = 0
    AS all_other_products_hidden,
  count(*) AS total_products,
  count(*) FILTER (WHERE keep) AS chain_members,
  count(*) FILTER (WHERE NOT is_active) AS hidden_products
FROM membership;