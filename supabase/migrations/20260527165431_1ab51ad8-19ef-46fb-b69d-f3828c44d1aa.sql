DO $$
DECLARE
  j RECORD;
  proj_url text := 'https://dqepeywgftbpxeeqfuwt.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxZXBleXdnZnRicHhlZXFmdXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMjgxMzksImV4cCI6MjA5MDkwNDEzOX0.OtLtoGBJZuEthQyePzNgAltWJwSUEpWl1z_Bx_FY6Mk';
BEGIN
  -- Unschedule any existing jobs targeting these functions
  FOR j IN SELECT jobname FROM cron.job
           WHERE command ILIKE '%billing-cron%'
              OR command ILIKE '%prewarm-cron%'
              OR command ILIKE '%partner-approve-commissions%'
  LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;

  -- billing-cron: daily at 02:15 UTC
  PERFORM cron.schedule(
    'billing-cron-daily',
    '15 2 * * *',
    format($f$
      select net.http_post(
        url:='%s/functions/v1/billing-cron',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'apikey','%s',
          'Authorization','Bearer %s',
          'x-cron-secret', current_setting('app.billing_cron_secret', true)
        ),
        body:='{}'::jsonb
      );
    $f$, proj_url, anon_key, anon_key)
  );

  -- prewarm-cron: every 15 minutes
  PERFORM cron.schedule(
    'prewarm-cron-15min',
    '*/15 * * * *',
    format($f$
      select net.http_post(
        url:='%s/functions/v1/prewarm-cron',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'apikey','%s',
          'Authorization','Bearer %s',
          'x-cron-secret', current_setting('app.prewarm_cron_secret', true)
        ),
        body:='{}'::jsonb
      );
    $f$, proj_url, anon_key, anon_key)
  );

  -- partner-approve-commissions: daily at 03:30 UTC
  PERFORM cron.schedule(
    'partner-approve-commissions-daily',
    '30 3 * * *',
    format($f$
      select net.http_post(
        url:='%s/functions/v1/partner-approve-commissions',
        headers:=jsonb_build_object(
          'Content-Type','application/json',
          'apikey','%s',
          'Authorization','Bearer %s',
          'x-cron-secret', current_setting('app.partner_cron_secret', true)
        ),
        body:='{}'::jsonb
      );
    $f$, proj_url, anon_key, anon_key)
  );
END $$;
