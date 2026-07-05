CREATE OR REPLACE FUNCTION public.wa_resolve_inbound_store(_phone text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT wm.store_id
  FROM public.whatsapp_messages wm
  WHERE wm.direction = 'outgoing'
    AND wm.store_id IS NOT NULL
    AND wm.recipient_phone = regexp_replace(coalesce(_phone, ''), '[^0-9]', '', 'g')
  ORDER BY wm.created_at DESC
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.store_wa_mark_thread_read(_store_id uuid, _phone text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.whatsapp_messages
     SET thread_read_at = now()
   WHERE direction = 'incoming'
     AND status = 'received'
     AND (sender_phone = _phone OR recipient_phone = _phone)
     AND (store_id = _store_id OR inferred_store_id = _store_id);

  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.whatsapp_messages
     SET status = 'read'
   WHERE thread_read_at IS NOT NULL
     AND status = 'received'
     AND (store_id = _store_id OR inferred_store_id = _store_id);

  RETURN n;
END
$$;

GRANT EXECUTE ON FUNCTION public.store_wa_mark_thread_read(uuid, text) TO authenticated;

UPDATE public.whatsapp_messages incoming
   SET inferred_store_id = resolved.store_id,
       store_id = resolved.store_id,
       updated_at = now()
  FROM (
    SELECT i.id,
           (
             SELECT wm.store_id
               FROM public.whatsapp_messages wm
              WHERE wm.direction = 'outgoing'
                AND wm.store_id IS NOT NULL
                AND wm.recipient_phone = coalesce(i.sender_phone, i.recipient_phone)
              ORDER BY wm.created_at DESC
              LIMIT 1
           ) AS store_id
      FROM public.whatsapp_messages i
     WHERE i.direction = 'incoming'
       AND i.store_id IS NULL
       AND i.inferred_store_id IS NULL
  ) resolved
 WHERE incoming.id = resolved.id
   AND resolved.store_id IS NOT NULL;