-- Add missing composite index for storefront product grid queries
-- (filter by store_id + is_active, order by display_order)
CREATE INDEX IF NOT EXISTS idx_products_store_active_order
  ON public.products (store_id, display_order, created_at DESC)
  WHERE is_active = true;

-- Drop duplicate index (idx_products_store and idx_products_store_id are identical)
DROP INDEX IF EXISTS public.idx_products_store_id;