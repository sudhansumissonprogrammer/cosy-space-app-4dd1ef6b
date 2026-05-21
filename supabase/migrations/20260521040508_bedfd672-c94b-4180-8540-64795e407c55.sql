-- Cost reduction: slow down over-eager cron jobs that bill edge invocations without adding UX value.
-- razorpay-reconcile: was every 5min (288/day); 0 pending payments in last 7 days makes 95%+ of runs no-ops.
-- prewarm-cron: was every 15min (96/day); CF edge SWR + KV 60s cache make 15-min warming overkill.

SELECT cron.unschedule('razorpay-reconcile-every-5min');
SELECT cron.unschedule('prewarm-cron-15min');

SELECT cron.schedule(
  'razorpay-reconcile-every-15min',
  '*/15 * * * *',
  $$ SELECT net.http_post(
       url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/razorpay-reconcile',
       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)),
       body := '{}'::jsonb
     ); $$
);

SELECT cron.schedule(
  'prewarm-cron-30min',
  '*/30 * * * *',
  $$ SELECT net.http_post(
       url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/prewarm-cron',
       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || current_setting('app.settings.service_role_key', true)),
       body := '{}'::jsonb
     ); $$
);