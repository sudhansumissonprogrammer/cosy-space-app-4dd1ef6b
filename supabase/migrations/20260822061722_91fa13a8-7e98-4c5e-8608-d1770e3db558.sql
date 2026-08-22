CREATE OR REPLACE FUNCTION public.rollup_customer_cohorts_monthly(_months_back integer DEFAULT 13)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rows_written integer := 0;
BEGIN
  DELETE FROM public.customer_cohorts_monthly
  WHERE cohort_month >= date_trunc('month', CURRENT_DATE - (_months_back || ' months')::interval)::date;

  WITH base AS (
    SELECT
      store_id,
      -- Phone is the stable identity; name is only a fallback when absent.
      COALESCE(NULLIF(regexp_replace(COALESCE(customer_phone, ''), '\D', '', 'g'), ''),
               'name:' || lower(trim(COALESCE(customer_name, '')))) AS cust_key,
      created_at,
      CASE WHEN status = 'partially_paid' THEN COALESCE(advance_paid, 0) ELSE COALESCE(total, 0) END AS rev
    FROM public.orders
    WHERE status IN ('confirmed','shipped','delivered','partially_paid','paid','completed')
      AND COALESCE(NULLIF(customer_phone, ''), NULLIF(customer_name, '')) IS NOT NULL
  ),
  first_order AS (
    SELECT store_id, cust_key, date_trunc('month', MIN(created_at))::date AS cohort_month
    FROM base GROUP BY store_id, cust_key
  ),
  all_orders AS (
    SELECT b.store_id, b.cust_key, f.cohort_month,
           date_trunc('month', b.created_at)::date AS order_month, b.rev
    FROM base b
    JOIN first_order f ON f.store_id = b.store_id AND f.cust_key = b.cust_key
    WHERE f.cohort_month >= date_trunc('month', CURRENT_DATE - (_months_back || ' months')::interval)::date
  ),
  agg AS (
    SELECT store_id, cohort_month,
           ((EXTRACT(YEAR FROM age(order_month, cohort_month))*12
             + EXTRACT(MONTH FROM age(order_month, cohort_month))))::int AS period_offset,
           COUNT(DISTINCT cust_key)::int AS returning_customers,
           COALESCE(SUM(rev), 0)::numeric AS revenue
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