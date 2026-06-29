
DO $$
DECLARE
  url TEXT := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1';
  s TEXT;
BEGIN
  SELECT ca.secret INTO s FROM public.cron_auth ca WHERE ca.id = true;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('wa-queue-worker-1min','wa-recovery-attribution-hourly');

  PERFORM cron.schedule(
    'wa-queue-worker-1min',
    '* * * * *',
    format($cmd$ SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L), body := '{}'::jsonb); $cmd$, url || '/wa-queue-worker', s)
  );

  PERFORM cron.schedule(
    'wa-recovery-attribution-hourly',
    '7 * * * *',
    format($cmd$ SELECT net.http_post(url := %L, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', %L), body := '{}'::jsonb); $cmd$, url || '/wa-recovery-attribution', s)
  );
END $$;
