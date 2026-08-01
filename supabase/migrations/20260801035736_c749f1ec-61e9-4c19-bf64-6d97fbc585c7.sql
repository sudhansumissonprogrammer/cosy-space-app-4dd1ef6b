select cron.schedule(
  'payu-reconcile-fast-1min',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/payu-reconcile',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','c676c140eecab4a97391a66e6d815f9b56b95ad4033bb3d4adcc37b96c4d4ab8'),
    body := '{"fast":true}'::jsonb
  );
  $$
);