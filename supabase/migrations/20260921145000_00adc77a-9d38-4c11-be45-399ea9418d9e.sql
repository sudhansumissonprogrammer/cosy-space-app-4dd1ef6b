ALTER TABLE public.migration_jobs
  ADD COLUMN IF NOT EXISTS detected_platform text,
  ADD COLUMN IF NOT EXISTS discovered_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.claim_migration_job(_job_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _claimed uuid;
BEGIN
  SELECT id INTO _claimed
  FROM public.migration_jobs
  WHERE (_job_id IS NULL OR id = _job_id)
    AND status IN ('pending', 'running')
    AND cancel_requested = false
    AND (lease_until IS NULL OR lease_until < now())
  ORDER BY created_at
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF _claimed IS NULL THEN RETURN NULL; END IF;
  UPDATE public.migration_jobs
  SET status = 'running', started_at = COALESCE(started_at, now()),
      lease_until = now() + interval '90 seconds', attempt_count = attempt_count + 1
  WHERE id = _claimed;
  RETURN _claimed;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_migration_job(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_migration_job(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.cancel_own_migration(_job_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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