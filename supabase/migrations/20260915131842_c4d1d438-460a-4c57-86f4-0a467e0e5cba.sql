REVOKE ALL ON FUNCTION public.enforce_review_not_verified() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_review_not_verified() TO service_role;