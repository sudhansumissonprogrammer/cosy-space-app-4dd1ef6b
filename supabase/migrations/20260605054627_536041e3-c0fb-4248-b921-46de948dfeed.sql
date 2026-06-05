
-- Rollup function: aggregates one day's raw page_views into page_views_daily.
-- Idempotent (ON CONFLICT upsert). SECURITY DEFINER so pg_cron + service code
-- can run it. Excludes bots; counts distinct visitor_id and session_id.
CREATE OR REPLACE FUNCTION public.rollup_page_views_daily(target_date date DEFAULT (current_date - 1))
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rows_written integer := 0;
BEGIN
  WITH agg AS (
    SELECT
      store_id,
      target_date AS date,
      count(*) FILTER (WHERE COALESCE(is_bot, false) = false) AS pageviews,
      count(DISTINCT COALESCE(session_id::text, visitor_id, ''))
        FILTER (WHERE COALESCE(is_bot, false) = false AND COALESCE(session_id::text, visitor_id, '') <> '') AS sessions,
      count(DISTINCT visitor_id)
        FILTER (WHERE COALESCE(is_bot, false) = false AND visitor_id IS NOT NULL AND visitor_id <> '') AS visitors,
      count(*) FILTER (WHERE COALESCE(is_bot, false) = true) AS bot_views
    FROM public.page_views
    WHERE created_at >= target_date::timestamptz
      AND created_at <  (target_date + 1)::timestamptz
      AND store_id IS NOT NULL
    GROUP BY store_id
  ),
  ups AS (
    INSERT INTO public.page_views_daily (store_id, date, pageviews, sessions, visitors, bot_views)
    SELECT store_id, date, pageviews, sessions, visitors, bot_views FROM agg
    ON CONFLICT (store_id, date) DO UPDATE SET
      pageviews = EXCLUDED.pageviews,
      sessions  = EXCLUDED.sessions,
      visitors  = EXCLUDED.visitors,
      bot_views = EXCLUDED.bot_views
    RETURNING 1
  )
  SELECT count(*) INTO rows_written FROM ups;

  RETURN rows_written;
END;
$$;

-- Backfill helper: rolls up every day in a range (inclusive).
CREATE OR REPLACE FUNCTION public.rollup_page_views_daily_range(from_date date, to_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d date;
  total integer := 0;
BEGIN
  FOR d IN SELECT generate_series(from_date, to_date, '1 day'::interval)::date LOOP
    total := total + public.rollup_page_views_daily(d);
  END LOOP;
  RETURN total;
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_page_views_daily(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rollup_page_views_daily_range(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_page_views_daily(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.rollup_page_views_daily_range(date, date) TO service_role;
