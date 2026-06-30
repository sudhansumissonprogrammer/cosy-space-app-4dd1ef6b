
-- Header media URL (IMAGE/VIDEO/DOCUMENT templates)
ALTER TABLE public.platform_wa_templates
  ADD COLUMN IF NOT EXISTS header_media_url text;

-- Pause/Cancel campaign RPCs
CREATE OR REPLACE FUNCTION public.wa_pause_campaign(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_status text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT status INTO v_status FROM public.platform_wa_campaigns WHERE id = _campaign_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'not_found'; END IF;
  UPDATE public.platform_wa_campaigns SET status='paused' WHERE id=_campaign_id;
  RETURN jsonb_build_object('ok', true, 'previous_status', v_status);
END;
$$;
REVOKE ALL ON FUNCTION public.wa_pause_campaign(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.wa_pause_campaign(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.wa_resume_campaign(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.platform_wa_campaigns SET status='queued' WHERE id=_campaign_id AND status='paused';
  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE ALL ON FUNCTION public.wa_resume_campaign(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.wa_resume_campaign(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.wa_cancel_campaign(_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_purged int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  WITH d AS (
    DELETE FROM public.wa_send_queue
     WHERE campaign_id = _campaign_id AND status IN ('pending','sending')
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_purged FROM d;
  UPDATE public.platform_wa_campaigns
     SET status='cancelled', completed_at = COALESCE(completed_at, now())
   WHERE id = _campaign_id;
  RETURN jsonb_build_object('ok', true, 'purged', v_purged);
END;
$$;
REVOKE ALL ON FUNCTION public.wa_cancel_campaign(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.wa_cancel_campaign(uuid) TO authenticated, service_role;

-- Update audience expander to support CSV-uploaded phone lists.
-- segment='csv' + phones:[...] returns those phones directly (admin-supplied list,
-- store/customer resolved best-effort from customer_segments_v1; falls back to a
-- minimal row so the sender can still target the number).
CREATE OR REPLACE FUNCTION public.expand_campaign_audience(
  _filter jsonb,
  _limit int DEFAULT 5000,
  _offset int DEFAULT 0
)
RETURNS TABLE (customer_id uuid, store_id uuid, phone text, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    UNION
    SELECT NULL::uuid, COALESCE((store_ids)[1], NULL::uuid), p, NULL::text
      FROM unnest(v_phones) p
     WHERE NOT EXISTS (SELECT 1 FROM public.customer_segments_v1 x WHERE x.phone = p)
    LIMIT _limit OFFSET _offset;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.customer_id, s.store_id, s.phone, s.name
    FROM public.customer_segments_v1 s
   WHERE s.phone IS NOT NULL
     AND (store_ids IS NULL OR s.store_id = ANY(store_ids))
     AND s.total_spent >= min_spent
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
$$;
