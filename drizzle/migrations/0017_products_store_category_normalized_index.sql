CREATE INDEX IF NOT EXISTS idx_products_store_category_norm
  ON public.products (store_id, lower(trim(COALESCE(category, ''))))
  WHERE is_active = true;