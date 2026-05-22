DROP INDEX IF EXISTS public.idx_stores_owner_id;
CREATE INDEX IF NOT EXISTS idx_stores_owner_active
  ON public.stores (owner_id)
  WHERE is_suspended = false;