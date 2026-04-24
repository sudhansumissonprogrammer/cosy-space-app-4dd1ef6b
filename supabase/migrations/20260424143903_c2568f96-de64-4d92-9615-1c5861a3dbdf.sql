-- Reverse display order of all products in "Ring-1" category for serdiyajewellers store.
-- Newest products get the lowest display_order (appear first), oldest get the highest.
WITH ranked AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (ORDER BY p.created_at DESC) - 1 AS new_order
  FROM products p
  JOIN stores s ON s.id = p.store_id
  WHERE s.owner_email = 'serdiyajewellers@gmail.com'
    AND LOWER(p.category) = 'ring-1'
)
UPDATE products p
SET display_order = ranked.new_order,
    updated_at = now()
FROM ranked
WHERE p.id = ranked.id;