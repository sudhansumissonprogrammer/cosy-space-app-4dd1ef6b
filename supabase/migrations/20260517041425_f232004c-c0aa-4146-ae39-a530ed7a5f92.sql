CREATE OR REPLACE FUNCTION public.cleanup_app_logs()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _pv_deleted int;
  _el_deleted int;
BEGIN
  WITH d AS (
    DELETE FROM public.page_views
    WHERE created_at < now() - interval '90 days'
    RETURNING 1
  ) SELECT count(*) INTO _pv_deleted FROM d;

  WITH d AS (
    DELETE FROM public.error_logs
    WHERE created_at < now() - interval '30 days'
    RETURNING 1
  ) SELECT count(*) INTO _el_deleted FROM d;

  RETURN json_build_object(
    'page_views_deleted', _pv_deleted,
    'error_logs_deleted', _el_deleted,
    'ran_at', now()
  );
END;
$$;

SELECT cron.schedule(
  'cleanup-app-logs-daily',
  '30 3 * * *',
  $$ SELECT public.cleanup_app_logs(); $$
);