CREATE OR REPLACE FUNCTION public.expand_campaign_audience(_filter jsonb, _limit integer DEFAULT 5000, _offset integer DEFAULT 0)
 RETURNS TABLE(customer_id uuid, store_id uuid, phone text, name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  seg text := COALESCE(_filter->>'segment', 'all');
  store_ids uuid[];
  min_spent numeric := COALESCE((_filter->>'min_spent')::numeric, 0);
  v_phones text[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF _filter ? 'store_id' AND (_filter->>'store_id') <> '' THEN
    store_ids := ARRAY[(_filter->>'store_id')::uuid];
  ELSIF _filter ? 'store_ids' AND jsonb_typeof(_filter->'store_ids') = 'array' THEN
    SELECT array_agg((value)::uuid) INTO store_ids FROM jsonb_array_elements_text(_filter->'store_ids');
  END IF;

  IF seg = 'csv' THEN
    IF NOT (_filter ? 'phones') OR jsonb_typeof(_filter->'phones') <> 'array' THEN
      RETURN;
    END IF;
    SELECT array_agg(value) INTO v_phones FROM jsonb_array_elements_text(_filter->'phones');
    RETURN QUERY
    SELECT s.customer_id, s.store_id, s.phone, s.name
      FROM public.customer_segments_v1 s
     WHERE s.phone = ANY(v_phones)
       AND (store_ids IS NULL OR s.store_id = ANY(store_ids))
       -- 🚫 R1: exclude opted-out phones (global + per-store)
       AND NOT EXISTS (SELECT 1 FROM public.whatsapp_optouts o WHERE o.phone = s.phone)
    UNION
    SELECT NULL::uuid, COALESCE((store_ids)[1], NULL::uuid), p, NULL::text
      FROM unnest(v_phones) p
     WHERE NOT EXISTS (SELECT 1 FROM public.customer_segments_v1 x WHERE x.phone = p)
       -- 🚫 R1: exclude opted-out CSV rows too
       AND NOT EXISTS (SELECT 1 FROM public.whatsapp_optouts o WHERE o.phone = p)
    LIMIT _limit OFFSET _offset;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.customer_id, s.store_id, s.phone, s.name
    FROM public.customer_segments_v1 s
   WHERE s.phone IS NOT NULL
     AND (store_ids IS NULL OR s.store_id = ANY(store_ids))
     AND s.total_spent >= min_spent
     -- 🚫 R1: exclude opted-out phones from every segment
     AND NOT EXISTS (SELECT 1 FROM public.whatsapp_optouts o WHERE o.phone = s.phone)
     AND CASE seg
       WHEN 'all' THEN true
       WHEN 'with_orders' THEN s.total_orders > 0
       WHEN 'no_orders' THEN s.total_orders = 0
       WHEN 'without_orders' THEN s.total_orders = 0
       WHEN 'high_value' THEN s.total_spent >= 5000
       WHEN 'vip' THEN s.total_orders >= 3 AND s.total_spent >= 10000
       WHEN 'abandoned_cart' THEN s.has_abandoned_cart
       WHEN 'recent_30d' THEN s.last_order_at > now() - interval '30 days'
       WHEN 'last_order_30d' THEN s.last_order_at > now() - interval '30 days'
       WHEN 'inactive_90d' THEN s.last_order_at IS NULL OR s.last_order_at < now() - interval '90 days'
       ELSE true
     END
   ORDER BY s.total_spent DESC NULLS LAST
   LIMIT _limit OFFSET _offset;
END;
$function$;