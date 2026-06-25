-- Retention cron: cap raw analytics at 90 days. page_views_daily rollup is
-- preserved forever, so dashboards stay accurate. Bot rows purged after 7d.
-- Schedule: 21:00 UTC = 02:30 IST (next day). Daily.

-- Ensure pg_cron is available (no-op if already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Drop prior schedules of the same name (idempotent re-run)
DO $$
BEGIN
  PERFORM cron.unschedule('pv-retention-90d');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('pv-bot-purge-7d');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1) Retention: drop raw rows older than 90 days from page_views + storefront_events
SELECT cron.schedule(
  'pv-retention-90d',
  '0 21 * * *',
  $$
  DELETE FROM public.page_views        WHERE created_at < now() - interval '90 days';
  DELETE FROM public.storefront_events WHERE created_at < now() - interval '90 days';
  $$
);

-- 2) Bot purge: drop bot rows older than 7 days (they're worthless for analytics)
SELECT cron.schedule(
  'pv-bot-purge-7d',
  '30 21 * * *',
  $$
  DELETE FROM public.page_views WHERE is_bot = true AND created_at < now() - interval '7 days';
  $$
);
