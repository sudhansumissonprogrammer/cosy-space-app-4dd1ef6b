CREATE OR REPLACE FUNCTION public.store_upsert_shipment(_order_id uuid, _slug text, _courier_name text, _awb text, _tracking_url text DEFAULT NULL::text, _status text DEFAULT NULL::text, _shipment_id uuid DEFAULT NULL::uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
  v_id uuid;
  v_order_status text;
  v_status text := CASE
    WHEN _shipment_id IS NULL THEN 'shipped'
    ELSE coalesce(nullif(btrim(_status), ''), 'shipped')
  END;
BEGIN
  IF _awb IS NULL OR btrim(_awb) !~ '^[A-Za-z0-9._-]{4,40}$' THEN
    RAISE EXCEPTION 'invalid tracking number';
  END IF;
  IF _slug IS NULL OR btrim(_slug) !~ '^[a-z0-9_-]{2,32}$' THEN
    RAISE EXCEPTION 'invalid courier';
  END IF;
  IF v_status NOT IN ('confirmed','packed','shipped','in_transit','reached_hub','out_for_delivery','delivered','returned','cancelled','exception') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT o.store_id INTO v_store
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = _order_id AND s.owner_id = auth.uid();

  IF v_store IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF _shipment_id IS NOT NULL THEN
    UPDATE public.order_shipments
       SET provider = _slug, tracking_slug = _slug, courier_name = _courier_name,
           awb = btrim(_awb), tracking_url = _tracking_url,
           normalized_status = v_status, status = v_status,
           is_active = v_status NOT IN ('delivered','returned','cancelled'),
           next_sync_at = now(), sync_attempts = 0, updated_at = now()
     WHERE id = _shipment_id AND store_id = v_store
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'shipment not found'; END IF;
  ELSE
    INSERT INTO public.order_shipments (
      order_id, store_id, provider, tracking_slug, courier_name, awb,
      tracking_url, normalized_status, status, is_active, next_sync_at
    ) VALUES (
      _order_id, v_store, _slug, _slug, _courier_name, btrim(_awb),
      _tracking_url, v_status, v_status,
      true, now()
    ) RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.shipment_events (shipment_id, store_id, status, raw_status, description, event_time, event_hash)
  VALUES (v_id, v_store, v_status, v_status, 'Status updated by seller', now(), md5(v_id::text || v_status || date_trunc('minute', now())::text))
  ON CONFLICT DO NOTHING;

  v_order_status := CASE
    WHEN v_status = 'delivered' THEN 'delivered'
    WHEN v_status IN ('returned','cancelled') THEN 'cancelled'
    WHEN v_status IN ('shipped','in_transit','reached_hub','out_for_delivery') THEN 'shipped'
    ELSE NULL
  END;

  UPDATE public.orders
     SET tracking_number = btrim(_awb),
         tracking_url = coalesce(_tracking_url, tracking_url),
         status = CASE
                    WHEN v_order_status IS NULL THEN status
                    WHEN status = 'cancelled' AND v_order_status <> 'cancelled' THEN status
                    ELSE v_order_status
                  END,
         updated_at = now()
   WHERE id = _order_id;

  RETURN v_id;
END;
$function$;