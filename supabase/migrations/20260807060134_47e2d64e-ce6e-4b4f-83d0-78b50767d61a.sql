-- 1. Extend order_shipments
ALTER TABLE public.order_shipments
  ADD COLUMN IF NOT EXISTS tracking_slug text,
  ADD COLUMN IF NOT EXISTS normalized_status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS current_location text,
  ADD COLUMN IF NOT EXISTS estimated_delivery timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_sync_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sync_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notified_statuses text[] NOT NULL DEFAULT '{}';

-- 2. shipment_events
CREATE TABLE IF NOT EXISTS public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.order_shipments(id) ON DELETE CASCADE,
  store_id uuid NOT NULL,
  status text NOT NULL,
  raw_status text,
  description text,
  location text,
  event_time timestamptz NOT NULL DEFAULT now(),
  event_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shipment_events TO authenticated;
GRANT ALL ON public.shipment_events TO service_role;

ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own shipment events"
ON public.shipment_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = shipment_events.store_id AND s.owner_id = auth.uid()));

-- 3. Indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_shipment_events_hash ON public.shipment_events(shipment_id, event_hash);
CREATE INDEX IF NOT EXISTS idx_shipment_events_ship_time ON public.shipment_events(shipment_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_order_shipments_sync ON public.order_shipments(next_sync_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_order_shipments_order ON public.order_shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_order_shipments_store_created ON public.order_shipments(store_id, created_at DESC);

-- 4. Customer tracking read (security definer; order id acts as the capability token)
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

-- 5. Merchant save shipment
CREATE OR REPLACE FUNCTION public.store_upsert_shipment(
  _order_id uuid,
  _slug text,
  _courier_name text,
  _awb text,
  _tracking_url text DEFAULT NULL,
  _status text DEFAULT NULL,
  _shipment_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store uuid;
  v_id uuid;
  v_status text := coalesce(nullif(btrim(_status), ''), 'shipped');
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
      v_status NOT IN ('delivered','returned','cancelled'), now()
    ) RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.shipment_events (shipment_id, store_id, status, raw_status, description, event_time, event_hash)
  VALUES (v_id, v_store, v_status, v_status, 'Status updated by seller', now(), md5(v_id::text || v_status || date_trunc('minute', now())::text))
  ON CONFLICT DO NOTHING;

  UPDATE public.orders
     SET tracking_number = btrim(_awb),
         tracking_url = coalesce(_tracking_url, tracking_url),
         updated_at = now()
   WHERE id = _order_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.store_upsert_shipment(uuid, text, text, text, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.store_upsert_shipment(uuid, text, text, text, text, text, uuid) TO authenticated, service_role;