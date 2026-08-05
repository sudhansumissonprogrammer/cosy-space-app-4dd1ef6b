CREATE INDEX IF NOT EXISTS idx_wa_messages_store_created ON public.whatsapp_messages (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_messages_inferred_store_created ON public.whatsapp_messages (inferred_store_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.store_wa_assert_access(_store_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _store_id IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF public.has_role(auth.uid(), 'admin') THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid()) THEN RETURN; END IF;
  RAISE EXCEPTION 'forbidden';
END;
$$;

DROP FUNCTION IF EXISTS public.store_wa_threads(uuid, text, integer, integer);
CREATE FUNCTION public.store_wa_threads(_store_id uuid, _search text DEFAULT NULL, _limit integer DEFAULT 30, _offset integer DEFAULT 0)
RETURNS TABLE(
  phone text,
  name text,
  last_body text,
  last_media_type text,
  last_direction text,
  last_status text,
  last_at timestamptz,
  unread integer,
  last_incoming_at timestamptz,
  total_threads bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _lim integer := LEAST(GREATEST(COALESCE(_limit, 30), 1), 100);
BEGIN
  PERFORM public.store_wa_assert_access(_store_id);

  RETURN QUERY
  WITH base AS (
    SELECT
      CASE WHEN m.direction = 'incoming'
           THEN COALESCE(m.sender_phone, m.recipient_phone)
           ELSE m.recipient_phone END AS ph,
      m.*
    FROM public.whatsapp_messages m
    WHERE (m.store_id = _store_id OR m.inferred_store_id = _store_id)
  ), cleaned AS (
    SELECT * FROM base WHERE ph IS NOT NULL AND length(trim(ph)) > 0
  ), agg AS (
    SELECT
      c.ph AS phone,
      (ARRAY_AGG(NULLIF(btrim(c.recipient_name), '') ORDER BY c.created_at DESC)
        FILTER (WHERE NULLIF(btrim(c.recipient_name), '') IS NOT NULL
                AND lower(btrim(c.recipient_name)) <> 'there'))[1] AS name,
      (ARRAY_AGG(c.message_body ORDER BY c.created_at DESC))[1] AS last_body,
      (ARRAY_AGG(c.media_type ORDER BY c.created_at DESC))[1] AS last_media_type,
      (ARRAY_AGG(c.direction ORDER BY c.created_at DESC))[1] AS last_direction,
      (ARRAY_AGG(c.status ORDER BY c.created_at DESC))[1] AS last_status,
      MAX(c.created_at) AS last_at,
      COUNT(*) FILTER (WHERE c.direction = 'incoming' AND c.status = 'received')::int AS unread,
      MAX(c.created_at) FILTER (WHERE c.direction = 'incoming') AS last_incoming_at
    FROM cleaned c
    GROUP BY c.ph
  ), filtered AS (
    SELECT * FROM agg a
    WHERE _search IS NULL OR btrim(_search) = ''
       OR a.phone ILIKE '%' || btrim(_search) || '%'
       OR COALESCE(a.name, '') ILIKE '%' || btrim(_search) || '%'
  )
  SELECT f.phone, f.name, f.last_body, f.last_media_type, f.last_direction, f.last_status,
         f.last_at, f.unread, f.last_incoming_at,
         (SELECT COUNT(*) FROM filtered) AS total_threads
  FROM filtered f
  ORDER BY f.last_at DESC
  LIMIT _lim OFFSET GREATEST(COALESCE(_offset, 0), 0);
END;
$$;

DROP FUNCTION IF EXISTS public.store_wa_thread_messages(uuid, text, timestamptz, integer);
CREATE FUNCTION public.store_wa_thread_messages(_store_id uuid, _phone text, _before timestamptz DEFAULT NULL, _limit integer DEFAULT 40)
RETURNS TABLE(
  id uuid,
  direction text,
  message_body text,
  media_type text,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _lim integer := LEAST(GREATEST(COALESCE(_limit, 40), 1), 100);
BEGIN
  PERFORM public.store_wa_assert_access(_store_id);

  RETURN QUERY
  SELECT m.id, m.direction, m.message_body, m.media_type, m.status, m.created_at
  FROM public.whatsapp_messages m
  WHERE (m.store_id = _store_id OR m.inferred_store_id = _store_id)
    AND (
      (m.direction = 'incoming' AND COALESCE(m.sender_phone, m.recipient_phone) = _phone)
      OR (m.direction <> 'incoming' AND m.recipient_phone = _phone)
    )
    AND (_before IS NULL OR m.created_at < _before)
  ORDER BY m.created_at DESC
  LIMIT _lim;
END;
$$;

DROP FUNCTION IF EXISTS public.store_wa_mark_thread_read(uuid, text);
CREATE FUNCTION public.store_wa_mark_thread_read(_store_id uuid, _phone text)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  PERFORM public.store_wa_assert_access(_store_id);
  UPDATE public.whatsapp_messages
     SET thread_read_at = now(), status = 'read'
   WHERE direction = 'incoming' AND status = 'received'
     AND (store_id = _store_id OR inferred_store_id = _store_id)
     AND (sender_phone = _phone OR recipient_phone = _phone);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.store_wa_assert_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.store_wa_threads(uuid, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.store_wa_thread_messages(uuid, text, timestamptz, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.store_wa_mark_thread_read(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_wa_threads(uuid, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_wa_thread_messages(uuid, text, timestamptz, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.store_wa_mark_thread_read(uuid, text) TO authenticated;