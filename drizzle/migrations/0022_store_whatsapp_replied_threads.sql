CREATE OR REPLACE FUNCTION public.store_wa_replied_threads(_store_id uuid, _search text DEFAULT NULL, _limit integer DEFAULT 30, _offset integer DEFAULT 0)
RETURNS TABLE(phone text, name text, last_body text, last_media_type text, last_direction text, last_status text, last_at timestamptz, unread integer, last_incoming_at timestamptz, total_threads bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _lim integer := LEAST(GREATEST(COALESCE(_limit, 30), 1), 100);
BEGIN
  PERFORM public.store_wa_assert_access(_store_id);
  RETURN QUERY
  WITH base AS (
    SELECT CASE WHEN m.direction = 'incoming' THEN COALESCE(m.sender_phone, m.recipient_phone) ELSE m.recipient_phone END AS ph, m.*
    FROM public.whatsapp_messages m
    WHERE (m.store_id = _store_id OR m.inferred_store_id = _store_id)
  ), cleaned AS (
    SELECT * FROM base WHERE ph IS NOT NULL AND length(trim(ph)) > 0
  ), agg AS (
    SELECT c.ph AS phone,
      (ARRAY_AGG(NULLIF(btrim(c.recipient_name), '') ORDER BY c.created_at DESC, c.id DESC) FILTER (WHERE NULLIF(btrim(c.recipient_name), '') IS NOT NULL AND lower(btrim(c.recipient_name)) <> 'there'))[1] AS name,
      (ARRAY_AGG(c.message_body ORDER BY c.created_at DESC, c.id DESC) FILTER (WHERE c.direction = 'incoming'))[1] AS last_body,
      (ARRAY_AGG(c.media_type ORDER BY c.created_at DESC, c.id DESC) FILTER (WHERE c.direction = 'incoming'))[1] AS last_media_type,
      'incoming'::text AS last_direction,
      (ARRAY_AGG(c.status ORDER BY c.created_at DESC, c.id DESC) FILTER (WHERE c.direction = 'incoming'))[1] AS last_status,
      MAX(c.created_at) FILTER (WHERE c.direction = 'incoming') AS last_at,
      COUNT(*) FILTER (WHERE c.direction = 'incoming' AND c.status = 'received')::int AS unread,
      MAX(c.created_at) FILTER (WHERE c.direction = 'incoming') AS last_incoming_at
    FROM cleaned c GROUP BY c.ph
    HAVING COUNT(*) FILTER (WHERE c.direction = 'incoming') > 0
  ), named AS (
    SELECT a.*, COALESCE(a.name, (
      SELECT NULLIF(btrim(cu.name), '') FROM public.customers cu
      WHERE cu.store_id = _store_id
        AND regexp_replace(COALESCE(cu.phone, ''), '\D', '', 'g') LIKE '%' || right(a.phone, 10)
        AND NULLIF(btrim(cu.name), '') IS NOT NULL LIMIT 1
    )) AS resolved_name FROM agg a
  ), filtered AS (
    SELECT * FROM named n WHERE _search IS NULL OR btrim(_search) = ''
      OR n.phone ILIKE '%' || btrim(_search) || '%'
      OR COALESCE(n.resolved_name, '') ILIKE '%' || btrim(_search) || '%'
  )
  SELECT f.phone, f.resolved_name, f.last_body, f.last_media_type, f.last_direction, f.last_status,
    f.last_at, f.unread, f.last_incoming_at, (SELECT COUNT(*) FROM filtered)
  FROM filtered f ORDER BY f.last_at DESC, f.phone ASC
  LIMIT _lim OFFSET GREATEST(COALESCE(_offset, 0), 0);
END;
$$;
REVOKE ALL ON FUNCTION public.store_wa_replied_threads(uuid, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.store_wa_replied_threads(uuid, text, integer, integer) TO authenticated;