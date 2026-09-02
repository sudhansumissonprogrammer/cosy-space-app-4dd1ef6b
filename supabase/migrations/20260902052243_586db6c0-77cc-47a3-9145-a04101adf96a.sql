-- 1) Leftover backup table: enable RLS, no policies => locked to app clients
ALTER TABLE public.price_bump_backup_utkal_20260828 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.price_bump_backup_utkal_20260828 FROM anon, authenticated;
GRANT ALL ON public.price_bump_backup_utkal_20260828 TO service_role;

-- 2) storefront_events: only allow inserts for active stores (mirrors page_views)
DROP POLICY IF EXISTS "Anyone can insert storefront events" ON public.storefront_events;
CREATE POLICY "Anyone can insert storefront events"
  ON public.storefront_events
  FOR INSERT
  WITH CHECK (is_store_active(store_id));

-- 3) Pin search_path on functions missing it
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public._touch_updated_at() SET search_path = public;
ALTER FUNCTION public.touch_updated_at() SET search_path = public;