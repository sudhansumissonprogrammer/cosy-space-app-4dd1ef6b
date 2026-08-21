-- 1) Stop all monitoring automation
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job
   WHERE jobname IN ('uptime-monitor-1min', 'health-signals-5min');
END $$;

-- 2) Drop all uptime tables (checks history is the 30MB blast risk)
DROP TABLE IF EXISTS public.uptime_checks CASCADE;
DROP TABLE IF EXISTS public.uptime_incidents CASCADE;
DROP TABLE IF EXISTS public.uptime_alert_recipients CASCADE;
DROP TABLE IF EXISTS public.uptime_targets CASCADE;

-- 3) Disable the monitoring WhatsApp alert template
UPDATE public.platform_wa_templates SET is_active = false WHERE name = 'platform_alert_v1';