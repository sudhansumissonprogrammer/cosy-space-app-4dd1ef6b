CREATE OR REPLACE FUNCTION public.wa_campaign_upload_stats(_campaign_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
    SELECT q.status, q.last_error, q.sent_message_id, m.status AS meta_status, m.error_message AS meta_error
    FROM wa_send_queue q
    LEFT JOIN LATERAL (
      SELECT wm.status, wm.error_message FROM whatsapp_messages wm
      WHERE q.sent_message_id IS NOT NULL AND wm.meta_message_id = q.sent_message_id
      ORDER BY wm.created_at DESC LIMIT 1
    ) m ON true
    WHERE q.campaign_id = _campaign_id
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'pending', count(*) FILTER (WHERE status IN ('pending','sending')),
    'accepted', count(*) FILTER (WHERE status = 'sent'),
    'delivered', count(*) FILTER (WHERE status = 'sent' AND meta_status IN ('delivered','read')),
    'read', count(*) FILTER (WHERE status = 'sent' AND meta_status = 'read'),
    'not_delivered', count(*) FILTER (WHERE status = 'sent' AND meta_status = 'failed'),
    'skipped', count(*) FILTER (WHERE status = 'skipped'),
    'failed', count(*) FILTER (WHERE status = 'failed'),
    'reasons', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('reason', r, 'count', c) ORDER BY c DESC)
      FROM (
        SELECT CASE
          WHEN status = 'skipped' THEN COALESCE(last_error, 'skipped')
          WHEN status = 'failed' THEN COALESCE(substring(last_error from '"code":\s*(\d+)'), 'send_failed')
          ELSE COALESCE(substring(meta_error from '"code":\s*(\d+)'), left(meta_error, 80), 'not_delivered')
        END AS r, count(*) AS c
        FROM q WHERE status IN ('skipped','failed') OR (status = 'sent' AND meta_status = 'failed')
        GROUP BY 1 ORDER BY 2 DESC LIMIT 15
      ) x), '[]'::jsonb)
  ) FROM q;
$$;
REVOKE ALL ON FUNCTION public.wa_campaign_upload_stats(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_campaign_upload_stats(uuid) TO service_role;
CREATE INDEX IF NOT EXISTS idx_wa_send_queue_campaign ON public.wa_send_queue (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_meta_id ON public.whatsapp_messages (meta_message_id) WHERE meta_message_id IS NOT NULL;