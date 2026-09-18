CREATE OR REPLACE FUNCTION public.get_shipment_tracking(_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  IF _order_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(x ORDER BY x->>'created_at'), '[]'::jsonb) INTO result
  FROM (
    SELECT jsonb_build_object(
      'id', s.id,
      'provider', s.provider,
      'tracking_slug', coalesce(s.tracking_slug, s.provider),
      'courier_name', s.courier_name,
      'awb', s.awb,
      'status', s.normalized_status,
      'current_location', s.current_location,
      'estimated_delivery', s.estimated_delivery,
      'tracking_url', s.tracking_url,
      'last_synced_at', s.last_synced_at,
      'next_sync_at', s.next_sync_at,
      'last_error', s.last_error,
      'created_at', s.created_at,
      'events', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'status', e.status,
          'description', e.description,
          'location', e.location,
          'event_time', e.event_time
        ) ORDER BY e.event_time DESC), '[]'::jsonb)
        FROM public.shipment_events e WHERE e.shipment_id = s.id
      )
    ) AS x
    FROM public.order_shipments s
    WHERE s.order_id = _order_id
  ) t;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_shipment_tracking(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_shipment_tracking(uuid) TO anon, authenticated, service_role;