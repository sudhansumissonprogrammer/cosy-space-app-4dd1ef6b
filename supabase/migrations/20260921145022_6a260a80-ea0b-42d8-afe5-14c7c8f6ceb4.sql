CREATE OR REPLACE FUNCTION public.cancel_own_migration(_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  UPDATE public.migration_jobs j
  SET cancel_requested = true, status = 'cancelled', completed_at = now(), credentials = '{}'::jsonb, lease_until = NULL
  WHERE j.id = _job_id
    AND (public.is_store_owner(j.store_id) OR public.has_role(auth.uid(), 'admin'))
    AND j.status IN ('pending', 'running');
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_own_migration(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_own_migration(uuid) TO authenticated, service_role;