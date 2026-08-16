ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS source_sync_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source_synced_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_products_source_synced_at ON public.products (store_id, source_synced_at NULLS FIRST);
UPDATE public.stores SET source_sync_enabled = true WHERE slug = 'wristlife';