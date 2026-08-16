CREATE TABLE IF NOT EXISTS public.jd_sync_state (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  phase text NOT NULL DEFAULT 'backfill',
  page_cursor integer NOT NULL DEFAULT 1,
  last_run_at timestamptz,
  last_result jsonb,
  imported_total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.jd_sync_state TO service_role;

ALTER TABLE public.jd_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sync state"
  ON public.jd_sync_state FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_products_store_source_id
  ON public.products (store_id, source_id);

CREATE INDEX IF NOT EXISTS idx_products_store_slug
  ON public.products (store_id, slug);