
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS visitor_id text,
  ADD COLUMN IF NOT EXISTS session_id text;

CREATE INDEX IF NOT EXISTS idx_page_views_store_session
  ON public.page_views (store_id, session_id)
  WHERE session_id IS NOT NULL AND is_bot = false;

CREATE INDEX IF NOT EXISTS idx_orders_store_visitor
  ON public.orders (store_id, visitor_id)
  WHERE visitor_id IS NOT NULL;
