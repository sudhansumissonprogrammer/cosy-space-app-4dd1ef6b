REVOKE EXECUTE ON FUNCTION public.verify_cron_secret(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_cron_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;
