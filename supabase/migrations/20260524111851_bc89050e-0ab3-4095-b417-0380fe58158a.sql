
-- ============================================================
-- Analytics Optimization Pack
-- 1. Daily rollup table for permanent history (page_views_daily)
-- 2. Extend raw retention 30d → 90d, rollup before delete
-- 3. Drop redundant visitor_ip column (visitor_id replaces it)
-- 4. Index on rollup for fast dashboard reads
-- ============================================================

-- 1. Daily rollup table
CREATE TABLE IF NOT EXISTS public.page_views_daily (
  store_id   uuid NOT NULL,
  date       date NOT NULL,
  pageviews  integer NOT NULL DEFAULT 0,
  sessions   integer NOT NULL DEFAULT 0,
  visitors   integer NOT NULL DEFAULT 0,
  bot_views  integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, date)
);

CREATE INDEX IF NOT EXISTS idx_pv_daily_date ON public.page_views_daily (date DESC);

ALTER TABLE public.page_views_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can view their daily rollups"
  ON public.page_views_daily FOR SELECT
  TO authenticated
  USING (is_store_owner(store_id));

CREATE POLICY "Admins can view all daily rollups"
  ON public.page_views_daily FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages daily rollups"
  ON public.page_views_daily FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. Drop redundant visitor_ip column (privacy + ~40 bytes/row saved)
ALTER TABLE public.page_views DROP COLUMN IF EXISTS visitor_ip;

-- 3. Rollup-then-delete cleanup (replaces old cleanup_app_logs page_views block)
CREATE OR REPLACE FUNCTION public.cleanup_app_logs()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _pv_rolled int;
  _pv_deleted int;
  _el_deleted int;
  _cl_deleted int;
BEGIN
  -- Roll up page_views older than 90 days into daily summary
  WITH agg AS (
    SELECT
      store_id,
      created_at::date AS date,
      COUNT(*) FILTER (WHERE is_bot = false)::int AS pageviews,
      COUNT(DISTINCT session_id) FILTER (WHERE is_bot = false AND session_id IS NOT NULL)::int AS sessions,
      COUNT(DISTINCT visitor_id) FILTER (WHERE is_bot = false AND visitor_id IS NOT NULL)::int AS visitors,
      COUNT(*) FILTER (WHERE is_bot = true)::int AS bot_views
    FROM public.page_views
    WHERE created_at < now() - interval '90 days'
    GROUP BY store_id, created_at::date
  ),
  upserted AS (
    INSERT INTO public.page_views_daily (store_id, date, pageviews, sessions, visitors, bot_views)
    SELECT store_id, date, pageviews, sessions, visitors, bot_views FROM agg
    ON CONFLICT (store_id, date) DO UPDATE SET
      pageviews = EXCLUDED.pageviews,
      sessions  = EXCLUDED.sessions,
      visitors  = EXCLUDED.visitors,
      bot_views = EXCLUDED.bot_views
    RETURNING 1
  )
  SELECT COUNT(*) INTO _pv_rolled FROM upserted;

  -- Then delete the raw rows
  WITH d AS (
    DELETE FROM public.page_views
    WHERE created_at < now() - interval '90 days'
    RETURNING 1
  ) SELECT count(*) INTO _pv_deleted FROM d;

  -- Error logs > 30 days
  WITH d AS (
    DELETE FROM public.error_logs
    WHERE created_at < now() - interval '30 days'
    RETURNING 1
  ) SELECT count(*) INTO _el_deleted FROM d;

  -- Customer leads > 180 days
  WITH d AS (
    DELETE FROM public.customer_leads
    WHERE created_at < now() - interval '180 days'
    RETURNING 1
  ) SELECT count(*) INTO _cl_deleted FROM d;

  RETURN json_build_object(
    'page_views_rolled_up_days', _pv_rolled,
    'page_views_deleted', _pv_deleted,
    'error_logs_deleted', _el_deleted,
    'customer_leads_deleted', _cl_deleted,
    'ran_at', now()
  );
END;
$function$;
