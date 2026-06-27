DO $$
DECLARE
  v_secret text;
BEGIN
  SELECT secret INTO v_secret FROM public.cron_auth WHERE id = true;

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'cron_auth secret missing; run cron_auth migration first';
  END IF;

  BEGIN
    PERFORM cron.unschedule('payu-reconcile-every-5min');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'payu-reconcile-every-5min',
    '*/5 * * * *',
    format($cmd$
      SELECT net.http_post(
        url := 'https://dqepeywgftbpxeeqfuwt.supabase.co/functions/v1/payu-reconcile',
        headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',%L),
        body := '{}'::jsonb
      );
    $cmd$, v_secret)
  );
END $$;