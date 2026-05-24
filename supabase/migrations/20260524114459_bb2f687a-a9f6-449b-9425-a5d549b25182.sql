
-- Path C: Cut raw page_views retention from 90 → 30 days.
-- page_views_daily rollup is unchanged and keeps history forever.
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
  -- Roll up page_views older than 30 days into daily summary (kept forever)
  WITH agg AS (
    SELECT
      store_id,
      created_at::date AS date,
      COUNT(*) FILTER (WHERE is_bot = false)::int AS pageviews,
      COUNT(DISTINCT session_id) FILTER (WHERE is_bot = false AND session_id IS NOT NULL)::int AS sessions,
      COUNT(DISTINCT visitor_id) FILTER (WHERE is_bot = false AND visitor_id IS NOT NULL)::int AS visitors,
      COUNT(*) FILTER (WHERE is_bot = true)::int AS bot_views
    FROM public.page_views
    WHERE created_at < now() - interval '30 days'
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

  -- Delete raw rows older than 30 days
  WITH d AS (
    DELETE FROM public.page_views
    WHERE created_at < now() - interval '30 days'
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

-- Speed up dashboard queries: store_id + created_at range scans
CREATE INDEX IF NOT EXISTS idx_page_views_store_created
  ON public.page_views (store_id, created_at DESC)
  WHERE is_bot = false;

CREATE INDEX IF NOT EXISTS idx_page_views_daily_store_date
  ON public.page_views_daily (store_id, date DESC);
