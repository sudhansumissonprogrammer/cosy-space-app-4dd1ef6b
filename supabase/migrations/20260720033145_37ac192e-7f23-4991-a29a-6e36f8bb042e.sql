SELECT cron.schedule(
  'capi-purchase-retry',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/capi-purchase-retry',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);