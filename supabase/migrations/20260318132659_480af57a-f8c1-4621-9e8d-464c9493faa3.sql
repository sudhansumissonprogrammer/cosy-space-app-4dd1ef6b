UPDATE categories c
SET image_url = sub.product_image
FROM (
  SELECT DISTINCT ON (c2.id) c2.id as cat_id, p.image_url as product_image
  FROM categories c2
  JOIN products p ON p.store_id = c2.store_id AND p.category = c2.name
  WHERE c2.image_url IS NULL AND p.image_url IS NOT NULL
  ORDER BY c2.id, random()
) sub
WHERE c.id = sub.cat_id;