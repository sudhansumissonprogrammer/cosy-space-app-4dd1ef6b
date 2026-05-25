
DROP FUNCTION IF EXISTS public.get_store_usage_stats();

CREATE OR REPLACE FUNCTION public.get_store_usage_stats()
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.views_today DESC), '[]'::json)
  INTO result
  FROM (
    SELECT
      s.id as store_id,
      s.name as store_name,
      s.slug as store_slug,
      s.logo_url,
      COALESCE(s.is_suspended, false) as is_suspended,
      s.created_at as store_created_at,
      COALESCE(pc.product_count, 0) as product_count,
      -- Orders: exclude pending & cancelled to match dashboard
      COALESCE(oc.order_count, 0) as total_orders,
      COALESCE(oc.orders_today, 0) as orders_today,
      COALESCE(oc.orders_7d, 0) as orders_7d,
      COALESCE(oc.total_revenue, 0) as total_revenue,
      -- Page views: exclude bots
      COALESCE(pv.total_views, 0) as total_page_views,
      COALESCE(pv.views_today, 0) as views_today,
      COALESCE(pv.views_7d, 0) as views_7d,
      COALESCE(pv.avg_daily_views_30d, 0) as avg_daily_views,
      -- New: unique visitors + sessions
      COALESCE(pv.visitors_today, 0) as visitors_today,
      COALESCE(pv.visitors_7d, 0) as visitors_7d,
      COALESCE(pv.sessions_today, 0) as sessions_today,
      COALESCE(pv.sessions_7d, 0) as sessions_7d,
      COALESCE(cc.customer_count, 0) as customer_count,
      COALESCE(wm.wa_messages, 0) as wa_messages_sent,
      COALESCE(catc.category_count, 0) as category_count,
      COALESCE(img.image_count, 0) as image_count,
      COALESCE(ac.cart_count, 0) as abandoned_carts
    FROM stores s
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as product_count
      FROM products p WHERE p.store_id = s.id
    ) pc ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int as order_count,
        COUNT(*) FILTER (WHERE o.created_at >= CURRENT_DATE)::int as orders_today,
        COUNT(*) FILTER (WHERE o.created_at >= CURRENT_DATE - INTERVAL '7 days')::int as orders_7d,
        COALESCE(SUM(o.total), 0)::numeric as total_revenue
      FROM orders o
      WHERE o.store_id = s.id
        AND o.status IN ('confirmed','shipped','delivered','partially_paid')
    ) oc ON true
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::bigint as total_views,
        COUNT(*) FILTER (WHERE pv.created_at >= CURRENT_DATE)::int as views_today,
        COUNT(*) FILTER (WHERE pv.created_at >= CURRENT_DATE - INTERVAL '7 days')::int as views_7d,
        ROUND(COUNT(*) FILTER (WHERE pv.created_at >= CURRENT_DATE - INTERVAL '30 days')::numeric / 30, 0)::int as avg_daily_views_30d,
        COUNT(DISTINCT pv.visitor_id) FILTER (WHERE pv.created_at >= CURRENT_DATE)::int as visitors_today,
        COUNT(DISTINCT pv.visitor_id) FILTER (WHERE pv.created_at >= CURRENT_DATE - INTERVAL '7 days')::int as visitors_7d,
        COUNT(DISTINCT pv.session_id) FILTER (WHERE pv.created_at >= CURRENT_DATE)::int as sessions_today,
        COUNT(DISTINCT pv.session_id) FILTER (WHERE pv.created_at >= CURRENT_DATE - INTERVAL '7 days')::int as sessions_7d
      FROM page_views pv
      WHERE pv.store_id = s.id
        AND COALESCE(pv.is_bot, false) = false
    ) pv ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as customer_count
      FROM customers c WHERE c.store_id = s.id
    ) cc ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as wa_messages
      FROM whatsapp_messages wm
      WHERE wm.store_id = s.id
        AND wm.direction IN ('outbound','outgoing')
    ) wm ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as category_count
      FROM categories cat WHERE cat.store_id = s.id
    ) catc ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as image_count
      FROM product_images pi
      JOIN products p2 ON p2.id = pi.product_id
      WHERE p2.store_id = s.id
    ) img ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as cart_count
      FROM abandoned_carts ac WHERE ac.store_id = s.id AND ac.recovered = false
    ) ac ON true
  ) t;

  RETURN result;
END;
$function$;
