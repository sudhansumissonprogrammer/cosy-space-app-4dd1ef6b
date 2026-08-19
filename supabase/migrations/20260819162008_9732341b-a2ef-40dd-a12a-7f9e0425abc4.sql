select cron.schedule(
  'cartpe-catalog-sync',
  '*/3 * * * *',
  $$
  select net.http_post(
    url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/cartpe-catalog-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select secret from public.cron_auth limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);

select cron.schedule(
  'cartpe-stock-sync',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/cartpe-stock-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-key', (select secret from public.cron_auth limit 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);