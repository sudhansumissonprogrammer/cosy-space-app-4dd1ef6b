-- Store Migration: jobs, source-of-truth mapping, and imported-entity tagging

CREATE TABLE IF NOT EXISTS public.migration_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  source_platform text NOT NULL CHECK (source_platform IN ('shopify','woocommerce','dukaan','bigcommerce','magento','generic')),
  source_url text NOT NULL,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  entities text[] NOT NULL DEFAULT ARRAY['products']::text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled')),
  progress jsonb NOT NULL DEFAULT '{}'::jsonb,
  cursor jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_store ON public.migration_jobs(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_jobs_status ON public.migration_jobs(status) WHERE status IN ('pending','running');

GRANT SELECT, INSERT, UPDATE ON public.migration_jobs TO authenticated;
GRANT ALL ON public.migration_jobs TO service_role;
ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage their migration jobs" ON public.migration_jobs;
CREATE POLICY "Owners manage their migration jobs" ON public.migration_jobs
  FOR ALL TO authenticated
  USING (is_store_owner(store_id) OR has_role(auth.uid(), 'admin'))
  WITH CHECK (is_store_owner(store_id) OR has_role(auth.uid(), 'admin'));

REVOKE SELECT (credentials) ON public.migration_jobs FROM authenticated;

CREATE TABLE IF NOT EXISTS public.migration_source_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.migration_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  source_id text NOT NULL,
  target_id uuid,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','skipped','failed')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, entity_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_migration_source_map_job ON public.migration_source_map(job_id, entity_type, status);

GRANT SELECT ON public.migration_source_map TO authenticated;
GRANT ALL ON public.migration_source_map TO service_role;
ALTER TABLE public.migration_source_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view their source map" ON public.migration_source_map;
CREATE POLICY "Owners view their source map" ON public.migration_source_map
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.migration_jobs j
    WHERE j.id = job_id AND (is_store_owner(j.store_id) OR has_role(auth.uid(), 'admin'))
  ));

-- Tag imported rows so re-runs are idempotent
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source_platform text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS source_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_source_dedup
  ON public.products(store_id, source_platform, source_id)
  WHERE source_platform IS NOT NULL AND source_id IS NOT NULL;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source_platform text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_migrated boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_source_dedup
  ON public.orders(store_id, source_platform, source_id)
  WHERE source_platform IS NOT NULL AND source_id IS NOT NULL;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS source_platform text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS source_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_source_dedup
  ON public.customers(store_id, source_platform, source_id)
  WHERE source_platform IS NOT NULL AND source_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_migration_jobs_updated_at ON public.migration_jobs;
CREATE TRIGGER trg_migration_jobs_updated_at
  BEFORE UPDATE ON public.migration_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();