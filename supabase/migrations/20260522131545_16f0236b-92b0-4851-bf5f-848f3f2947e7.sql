-- 1. Drop unused duplicate index on customer_leads (confirmed idx_scan = 0)
DROP INDEX IF EXISTS public.idx_customer_leads_store;

-- 2. Create combined dashboard stats RPC (4 queries -> 1)
DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_products int;
  _total_orders int;
  _total_customers int;
  _total_views bigint;
BEGIN
  -- Authorization: only store owner or admin
  IF NOT (is_store_owner(_store_id) OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO _total_products FROM products WHERE store_id = _store_id;
  SELECT COUNT(*) INTO _total_orders FROM orders WHERE store_id = _store_id;
  SELECT COUNT(*) INTO _total_customers FROM customers WHERE store_id = _store_id;
  SELECT COALESCE(COUNT(*), 0) INTO _total_views FROM page_views WHERE store_id = _store_id;

  RETURN jsonb_build_object(
    'total_products', _total_products,
    'total_orders', _total_orders,
    'total_customers', _total_customers,
    'total_views', _total_views
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;

-- 3. Schedule daily cleanup of old logs at 3:00 AM UTC
-- Ensure pg_cron is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove any prior schedule with same name to avoid duplicates
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-app-logs-daily')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-app-logs-daily');
EXCEPTION WHEN OTHERS THEN
  -- ignore if not present
  NULL;
END $$;

SELECT cron.schedule(
  'cleanup-app-logs-daily',
  '0 3 * * *',
  $cron$ SELECT public.cleanup_app_logs(); $cron$
);