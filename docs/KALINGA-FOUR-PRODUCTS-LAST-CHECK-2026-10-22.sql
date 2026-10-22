-- Assert the pictured products occupy the final four category positions.
WITH ranked AS (
  SELECT p.id, row_number() OVER (ORDER BY p.is_category_pinned DESC,
    p.category_pinned_at DESC NULLS LAST, p.display_order ASC, p.created_at DESC, p.id ASC) pos,
    count(*) OVER () total
  FROM public.products p
  WHERE p.store_id = 'c3c5dff2-173a-4f4d-90e4-8b1c88c305d9'
    AND p.is_active AND NOT p.hidden_by_category
    AND (lower(p.category) = 'chain with pendant' OR EXISTS (
      SELECT 1 FROM public.product_categories pc WHERE pc.product_id = p.id
        AND pc.category_id = 'ccbe216e-9bc8-4b72-9ee3-3bd8a1cacce2'))
), expected AS (
  SELECT id, ordinality n FROM unnest(ARRAY[
    'f86fb2f4-3529-4ba4-9a55-e6b777ef4a7e'::uuid,
    '2ce7ebd2-adcd-4c1e-8126-ece6cbaef4f9'::uuid,
    'd8c84ac7-638e-4a1a-ba61-43760369829b'::uuid,
    '809e527a-20d1-4f1c-bff4-87c376df9396'::uuid]) WITH ORDINALITY x(id, ordinality)
)
SELECT count(*) = 4 AND bool_and(r.pos = r.total - 4 + e.n) AS final_four_correct,
  (SELECT min(display_order) FROM public.products WHERE id IN (SELECT id FROM expected)) >
  (SELECT max(display_order) FROM public.products WHERE store_id = 'c3c5dff2-173a-4f4d-90e4-8b1c88c305d9'
    AND id NOT IN (SELECT id FROM expected)) AS homepage_last
FROM expected e JOIN ranked r USING (id);