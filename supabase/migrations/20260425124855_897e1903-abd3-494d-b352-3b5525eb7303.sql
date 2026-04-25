DELETE FROM public.product_variants
WHERE product_id IN (
  SELECT id FROM public.products WHERE LOWER(category) = 'ring-1'
);