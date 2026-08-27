
SELECT cron.unschedule('wa-cod-followup-15min')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-cod-followup-15min');

SELECT cron.schedule(
  'wa-cod-followup-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/wa-cod-followup-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT secret FROM public.cron_auth WHERE id = true)
    ),
    body := '{}'::jsonb
  );
  $$
);
