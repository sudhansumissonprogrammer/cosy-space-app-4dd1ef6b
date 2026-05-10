
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS visitor_id text;

CREATE INDEX IF NOT EXISTS idx_page_views_store_visitor
  ON public.page_views (store_id, visitor_id)
  WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_page_views_store_created
  ON public.page_views (store_id, created_at DESC);
