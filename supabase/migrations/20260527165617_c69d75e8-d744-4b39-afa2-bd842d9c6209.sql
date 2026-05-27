DO $$
DECLARE
  proj_url text := 'https://dqepeywgftbpxeeqfuwt.supabase.co';
BEGIN
  PERFORM cron.unschedule('billing-cron-daily');
  PERFORM cron.unschedule('prewarm-cron-15min');
  PERFORM cron.unschedule('partner-approve-commissions-daily');

  PERFORM cron.schedule(
    'billing-cron-daily',
    '15 2 * * *',
    format($f$
      select net.http_post(
        url:='%s/functions/v1/billing-cron',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true),
          'x-cron-secret', current_setting('app.settings.service_role_key', true)
        ),
        body:='{}'::jsonb
      );
    $f$, proj_url)
  );

  PERFORM cron.schedule(
    'prewarm-cron-15min',
    '*/15 * * * *',
    format($f$
      select net.http_post(
        url:='%s/functions/v1/prewarm-cron',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true),
          'x-cron-secret', current_setting('app.settings.service_role_key', true)
        ),
        body:='{}'::jsonb
      );
    $f$, proj_url)
  );

  PERFORM cron.schedule(
    'partner-approve-commissions-daily',
    '30 3 * * *',
    format($f$
      select net.http_post(
        url:='%s/functions/v1/partner-approve-commissions',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'Authorization','Bearer ' || current_setting('app.settings.service_role_key', true),
          'x-cron-secret', current_setting('app.settings.service_role_key', true)
        ),
        body:='{}'::jsonb
      );
    $f$, proj_url)
  );
END $$;
