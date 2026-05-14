SELECT cron.schedule(
  'razorpay-reconcile-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/razorpay-reconcile',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);