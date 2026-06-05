
-- 1. Stores timezone
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';

-- 2. page_views new dimensions (all nullable)
ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS device TEXT,
  ADD COLUMN IF NOT EXISTS browser TEXT,
  ADD COLUMN IF NOT EXISTS os TEXT,
  ADD COLUMN IF NOT EXISTS landing_path TEXT;

CREATE INDEX IF NOT EXISTS idx_page_views_store_recent
  ON public.page_views (store_id, created_at DESC);

-- 3. page_views_daily extra columns
ALTER TABLE public.page_views_daily
  ADD COLUMN IF NOT EXISTS bounce_sessions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_session_duration_seconds BIGINT NOT NULL DEFAULT 0;

-- 4. Rewrite rollup function (TZ-aware, with bounce + duration)
DROP FUNCTION IF EXISTS public.rollup_page_views_daily(date);

CREATE OR REPLACE FUNCTION public.rollup_page_views_daily(target_date date DEFAULT (CURRENT_DATE - 1))
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rows_written integer := 0;
BEGIN
  WITH base AS (
    SELECT
      pv.store_id,
      ((pv.created_at AT TIME ZONE COALESCE(s.timezone, 'Asia/Kolkata'))::date) AS local_date,
      pv.created_at,
      pv.session_id,
      pv.visitor_id,
      COALESCE(pv.is_bot, false) AS is_bot
    FROM public.page_views pv
    LEFT JOIN public.stores s ON s.id = pv.store_id
    WHERE pv.created_at >= (target_date - 1)::timestamptz
      AND pv.created_at <  (target_date + 2)::timestamptz
      AND pv.store_id IS NOT NULL
  ),
  filtered AS (
    SELECT * FROM base WHERE local_date = target_date
  ),
  sess AS (
    SELECT
      store_id,
      COALESCE(session_id::text, visitor_id, '') AS sk,
      COUNT(*) AS hits,
      EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at)))::bigint AS dur
    FROM filtered
    WHERE is_bot = false AND COALESCE(session_id::text, visitor_id, '') <> ''
    GROUP BY store_id, sk
  ),
  agg AS (
    SELECT
      f.store_id,
      target_date AS date,
      COUNT(*) FILTER (WHERE is_bot = false)::int AS pageviews,
      COUNT(DISTINCT COALESCE(f.session_id::text, f.visitor_id, ''))
        FILTER (WHERE is_bot = false AND COALESCE(f.session_id::text, f.visitor_id, '') <> '')::int AS sessions,
      COUNT(DISTINCT f.visitor_id)
        FILTER (WHERE is_bot = false AND f.visitor_id IS NOT NULL AND f.visitor_id <> '')::int AS visitors,
      COUNT(*) FILTER (WHERE is_bot = true)::int AS bot_views,
      COALESCE((SELECT COUNT(*) FROM sess WHERE sess.store_id = f.store_id AND sess.hits = 1), 0)::int AS bounce_sessions,
      COALESCE((SELECT SUM(dur) FROM sess WHERE sess.store_id = f.store_id), 0)::bigint AS total_session_duration_seconds
    FROM filtered f
    GROUP BY f.store_id
  ),
  ups AS (
    INSERT INTO public.page_views_daily (store_id, date, pageviews, sessions, visitors, bot_views, bounce_sessions, total_session_duration_seconds)
    SELECT store_id, date, pageviews, sessions, visitors, bot_views, bounce_sessions, total_session_duration_seconds FROM agg
    ON CONFLICT (store_id, date) DO UPDATE SET
      pageviews = EXCLUDED.pageviews,
      sessions  = EXCLUDED.sessions,
      visitors  = EXCLUDED.visitors,
      bot_views = EXCLUDED.bot_views,
      bounce_sessions = EXCLUDED.bounce_sessions,
      total_session_duration_seconds = EXCLUDED.total_session_duration_seconds
    RETURNING 1
  )
  SELECT count(*) INTO rows_written FROM ups;
  RETURN rows_written;
END;
$function$;

-- 5. storefront_events
CREATE TABLE IF NOT EXISTS public.storefront_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  session_id TEXT,
  visitor_id TEXT,
  event_name TEXT NOT NULL,
  product_id UUID,
  value NUMERIC,
  currency TEXT,
  path TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.storefront_events TO authenticated;
GRANT INSERT ON public.storefront_events TO anon, authenticated;
GRANT ALL ON public.storefront_events TO service_role;

ALTER TABLE public.storefront_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert storefront events"
  ON public.storefront_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Store owners can read their events"
  ON public.storefront_events FOR SELECT
  TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_storefront_events_store_created
  ON public.storefront_events (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_storefront_events_store_event
  ON public.storefront_events (store_id, event_name, created_at DESC);

-- 6. storefront_events_daily rollup
CREATE TABLE IF NOT EXISTS public.storefront_events_daily (
  store_id UUID NOT NULL,
  date DATE NOT NULL,
  event_name TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  unique_sessions INTEGER NOT NULL DEFAULT 0,
  value_sum NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, date, event_name)
);

GRANT SELECT ON public.storefront_events_daily TO authenticated;
GRANT ALL ON public.storefront_events_daily TO service_role;

ALTER TABLE public.storefront_events_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners read their event rollups"
  ON public.storefront_events_daily FOR SELECT
  TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.rollup_storefront_events_daily(target_date date DEFAULT (CURRENT_DATE - 1))
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rows_written integer := 0;
BEGIN
  WITH base AS (
    SELECT
      e.store_id,
      ((e.created_at AT TIME ZONE COALESCE(s.timezone, 'Asia/Kolkata'))::date) AS local_date,
      e.event_name,
      e.session_id,
      e.value
    FROM public.storefront_events e
    LEFT JOIN public.stores s ON s.id = e.store_id
    WHERE e.created_at >= (target_date - 1)::timestamptz
      AND e.created_at <  (target_date + 2)::timestamptz
      AND e.store_id IS NOT NULL
  ),
  filtered AS (SELECT * FROM base WHERE local_date = target_date),
  agg AS (
    SELECT
      store_id,
      target_date AS date,
      event_name,
      COUNT(*)::int AS count,
      COUNT(DISTINCT session_id)::int AS unique_sessions,
      COALESCE(SUM(value), 0)::numeric AS value_sum
    FROM filtered
    GROUP BY store_id, event_name
  ),
  ups AS (
    INSERT INTO public.storefront_events_daily (store_id, date, event_name, count, unique_sessions, value_sum)
    SELECT store_id, date, event_name, count, unique_sessions, value_sum FROM agg
    ON CONFLICT (store_id, date, event_name) DO UPDATE SET
      count = EXCLUDED.count,
      unique_sessions = EXCLUDED.unique_sessions,
      value_sum = EXCLUDED.value_sum
    RETURNING 1
  )
  SELECT count(*) INTO rows_written FROM ups;
  RETURN rows_written;
END;
$function$;

-- 7. customer_cohorts_monthly
CREATE TABLE IF NOT EXISTS public.customer_cohorts_monthly (
  store_id UUID NOT NULL,
  cohort_month DATE NOT NULL,
  period_offset INTEGER NOT NULL,
  customers INTEGER NOT NULL DEFAULT 0,
  returning_customers INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, cohort_month, period_offset)
);

GRANT SELECT ON public.customer_cohorts_monthly TO authenticated;
GRANT ALL ON public.customer_cohorts_monthly TO service_role;

ALTER TABLE public.customer_cohorts_monthly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners read their cohorts"
  ON public.customer_cohorts_monthly FOR SELECT
  TO authenticated
  USING (public.is_store_owner(store_id) OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.rollup_customer_cohorts_monthly(_months_back integer DEFAULT 13)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rows_written integer := 0;
BEGIN
  -- Delete + reinsert last N months for each store (small enough volume)
  DELETE FROM public.customer_cohorts_monthly
  WHERE cohort_month >= date_trunc('month', CURRENT_DATE - (_months_back || ' months')::interval)::date;

  WITH first_order AS (
    SELECT
      store_id,
      customer_name,
      MIN(created_at) AS first_at,
      date_trunc('month', MIN(created_at))::date AS cohort_month
    FROM public.orders
    WHERE status IN ('confirmed','shipped','delivered','partially_paid')
      AND customer_name IS NOT NULL
    GROUP BY store_id, customer_name
  ),
  all_orders AS (
    SELECT
      o.store_id,
      o.customer_name,
      f.cohort_month,
      date_trunc('month', o.created_at)::date AS order_month,
      o.total
    FROM public.orders o
    JOIN first_order f
      ON f.store_id = o.store_id AND f.customer_name = o.customer_name
    WHERE o.status IN ('confirmed','shipped','delivered','partially_paid')
      AND f.cohort_month >= date_trunc('month', CURRENT_DATE - (_months_back || ' months')::interval)::date
  ),
  agg AS (
    SELECT
      store_id,
      cohort_month,
      ((EXTRACT(YEAR FROM age(order_month, cohort_month))*12 + EXTRACT(MONTH FROM age(order_month, cohort_month))))::int AS period_offset,
      COUNT(DISTINCT customer_name)::int AS returning_customers,
      COALESCE(SUM(total), 0)::numeric AS revenue
    FROM all_orders
    GROUP BY store_id, cohort_month, order_month
  ),
  cohort_size AS (
    SELECT store_id, cohort_month, COUNT(*)::int AS customers
    FROM first_order
    WHERE cohort_month >= date_trunc('month', CURRENT_DATE - (_months_back || ' months')::interval)::date
    GROUP BY store_id, cohort_month
  ),
  ins AS (
    INSERT INTO public.customer_cohorts_monthly (store_id, cohort_month, period_offset, customers, returning_customers, revenue)
    SELECT a.store_id, a.cohort_month, a.period_offset, cs.customers, a.returning_customers, a.revenue
    FROM agg a
    JOIN cohort_size cs ON cs.store_id = a.store_id AND cs.cohort_month = a.cohort_month
    RETURNING 1
  )
  SELECT count(*) INTO rows_written FROM ins;
  RETURN rows_written;
END;
$function$;

-- 8. Backfill last 90 days with TZ-aware rollup
SELECT public.rollup_page_views_daily_range(
  (CURRENT_DATE - 90)::date,
  CURRENT_DATE::date
);

-- 9. Initial cohort backfill
SELECT public.rollup_customer_cohorts_monthly(24);
