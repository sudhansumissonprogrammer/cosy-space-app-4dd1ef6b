CREATE OR REPLACE FUNCTION public.get_wa_analytics_v2(_days integer DEFAULT 7)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin boolean;
  since timestamptz := now() - make_interval(days => GREATEST(_days,1));
  result jsonb;
BEGIN
  SELECT public.has_role(auth.uid(), 'admin') INTO is_admin;
  IF NOT COALESCE(is_admin, false) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  WITH base AS (
    SELECT * FROM public.whatsapp_messages
    WHERE created_at >= since AND direction IS DISTINCT FROM 'incoming'
  ),
  totals AS (
    SELECT
      COUNT(*)::int AS sent,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL OR status IN ('delivered','read'))::int AS delivered,
      COUNT(*) FILTER (WHERE read_at IS NOT NULL OR status = 'read')::int AS read_cnt,
      COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
      COUNT(*) FILTER (WHERE replied_at IS NOT NULL)::int AS replied,
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours')::int AS sent_24h,
      COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours' AND status='failed')::int AS failed_24h
    FROM base
  ),
  daily AS (
    SELECT date_trunc('day', created_at)::date AS day,
      COUNT(*)::int AS sent,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL OR status IN ('delivered','read'))::int AS delivered,
      COUNT(*) FILTER (WHERE read_at IS NOT NULL OR status='read')::int AS read_cnt,
      COUNT(*) FILTER (WHERE status='failed')::int AS failed
    FROM base
    GROUP BY 1 ORDER BY 1
  ),
  by_type AS (
    SELECT COALESCE(message_type,'unknown') AS type,
      COUNT(*)::int AS sent,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL OR status IN ('delivered','read'))::int AS delivered,
      COUNT(*) FILTER (WHERE read_at IS NOT NULL OR status='read')::int AS read_cnt,
      COUNT(*) FILTER (WHERE status='failed')::int AS failed
    FROM base GROUP BY 1 ORDER BY sent DESC LIMIT 20
  ),
  by_store AS (
    SELECT b.store_id,
      COALESCE(s.name, 'Unknown') AS store_name,
      s.slug AS store_slug,
      COUNT(*)::int AS sent,
      COUNT(*) FILTER (WHERE b.delivered_at IS NOT NULL OR b.status IN ('delivered','read'))::int AS delivered,
      COUNT(*) FILTER (WHERE b.read_at IS NOT NULL OR b.status='read')::int AS read_cnt,
      COUNT(*) FILTER (WHERE b.status='failed')::int AS failed,
      COUNT(*) FILTER (WHERE b.replied_at IS NOT NULL)::int AS replied
    FROM base b LEFT JOIN public.stores s ON s.id = b.store_id
    GROUP BY b.store_id, s.name, s.slug
    ORDER BY sent DESC LIMIT 25
  ),
  by_template AS (
    SELECT COALESCE(template_name, '(none)') AS template,
      COUNT(*)::int AS sent,
      COUNT(*) FILTER (WHERE delivered_at IS NOT NULL OR status IN ('delivered','read'))::int AS delivered,
      COUNT(*) FILTER (WHERE read_at IS NOT NULL OR status='read')::int AS read_cnt,
      COUNT(*) FILTER (WHERE status='failed')::int AS failed,
      COUNT(*) FILTER (WHERE replied_at IS NOT NULL)::int AS replied
    FROM base
    WHERE template_name IS NOT NULL
    GROUP BY 1 ORDER BY sent DESC LIMIT 20
  ),
  failures AS (
    SELECT COALESCE(NULLIF(error_message,''),'unknown') AS reason, COUNT(*)::int AS n
    FROM base WHERE status='failed'
    GROUP BY 1 ORDER BY n DESC LIMIT 10
  ),
  recovery AS (
    SELECT
      COUNT(DISTINCT recovered_order_id)::int AS orders,
      COALESCE(SUM(o.total),0)::numeric AS revenue
    FROM public.whatsapp_messages m
    LEFT JOIN public.orders o ON o.id = m.recovered_order_id
    WHERE m.recovered_order_id IS NOT NULL
      AND m.created_at >= now() - interval '30 days'
  ),
  queue AS (
    SELECT COUNT(*)::int AS depth FROM public.wa_send_queue WHERE status IN ('queued','processing','retry')
  ),
  cfg AS (
    SELECT wa_quality_rating, wa_messaging_tier, wa_tier_limit, wa_meta_breaker
    FROM public.platform_config LIMIT 1
  )
  SELECT jsonb_build_object(
    'window_days', _days,
    'totals', (SELECT to_jsonb(totals) FROM totals),
    'daily', COALESCE((SELECT jsonb_agg(to_jsonb(d)) FROM daily d), '[]'::jsonb),
    'by_type', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM by_type t), '[]'::jsonb),
    'by_store', COALESCE((SELECT jsonb_agg(to_jsonb(s)) FROM by_store s), '[]'::jsonb),
    'by_template', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM by_template t), '[]'::jsonb),
    'failures', COALESCE((SELECT jsonb_agg(to_jsonb(f)) FROM failures f), '[]'::jsonb),
    'recovery', (SELECT to_jsonb(recovery) FROM recovery),
    'queue_depth', (SELECT depth FROM queue),
    'health', (SELECT to_jsonb(cfg) FROM cfg)
  ) INTO result;

  RETURN result;
END;
$function$;