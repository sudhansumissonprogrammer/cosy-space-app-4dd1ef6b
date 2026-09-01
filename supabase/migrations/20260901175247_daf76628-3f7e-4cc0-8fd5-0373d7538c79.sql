CREATE OR REPLACE FUNCTION public.wa_reclaim_stale_sending(p_grace_minutes int DEFAULT 5, p_limit int DEFAULT 500)
RETURNS TABLE(requeued int, failed int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz := now() - make_interval(mins => greatest(p_grace_minutes, 1));
  v_requeued int := 0;
  v_failed int := 0;
BEGIN
  WITH stale AS (
    SELECT id, attempts, max_attempts
    FROM public.wa_send_queue
    WHERE status = 'sending'
      AND coalesce(locked_until, updated_at) < v_cutoff
    ORDER BY updated_at ASC
    LIMIT greatest(p_limit, 1)
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.wa_send_queue q
    SET attempts = coalesce(q.attempts, 0) + 1,
        locked_until = NULL,
        last_error_class = 'transient',
        last_error = 'stale_lock_reclaimed',
        status = CASE
          WHEN coalesce(q.attempts, 0) + 1 >= coalesce(q.max_attempts, 4) THEN 'failed'
          ELSE 'pending'
        END,
        scheduled_at = CASE
          WHEN coalesce(q.attempts, 0) + 1 >= coalesce(q.max_attempts, 4) THEN q.scheduled_at
          ELSE now()
        END
    FROM stale s
    WHERE q.id = s.id
    RETURNING q.status
  )
  SELECT count(*) FILTER (WHERE status = 'pending'),
         count(*) FILTER (WHERE status = 'failed')
  INTO v_requeued, v_failed
  FROM upd;

  RETURN QUERY SELECT coalesce(v_requeued, 0), coalesce(v_failed, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.wa_reclaim_stale_sending(int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.wa_reclaim_stale_sending(int, int) TO service_role;