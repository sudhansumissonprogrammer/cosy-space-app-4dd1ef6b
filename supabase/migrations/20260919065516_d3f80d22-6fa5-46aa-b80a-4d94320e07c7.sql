ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'processing'::text, 'shipped'::text, 'delivered'::text, 'cancelled'::text, 'partially_paid'::text, 'rto'::text]));

CREATE OR REPLACE FUNCTION public.protect_rto_order_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'rto' AND COALESCE(OLD.status, '') <> 'rto' THEN
    IF OLD.status <> 'shipped' THEN
      RAISE EXCEPTION 'rto_requires_shipped_order';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.parcel_label_scans pls
      WHERE pls.order_id = OLD.id
        AND pls.store_id = OLD.store_id
        AND pls.decision = 'accepted'
    ) THEN
      RAISE EXCEPTION 'rto_requires_verified_parcel_photo';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_protect_rto_order_transition ON public.orders;
CREATE TRIGGER trg_protect_rto_order_transition
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_rto_order_transition();

CREATE OR REPLACE FUNCTION public.tg_order_commission_handler()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  earning_statuses text[] := ARRAY['confirmed','shipped','delivered','partially_paid'];
  already_charged boolean;
  is_chargeable boolean;
BEGIN
  is_chargeable := (NEW.status = ANY(earning_statuses))
                   AND (
                     COALESCE(NEW.payment_method,'cod') = 'cod'
                     OR NEW.payment_verified = true
                   );

  IF TG_OP = 'INSERT' THEN
    IF is_chargeable THEN
      PERFORM public.wallet_charge_order(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- Order status is operational only. Cancellation, RTO, delivery and all
  -- other status changes must never refund or reverse the platform fee.
  IF NEW.status IN ('cancelled', 'rto') THEN
    RETURN NEW;
  END IF;

  IF is_chargeable AND (
       (NEW.status IS DISTINCT FROM OLD.status AND NOT (OLD.status = ANY(earning_statuses)))
       OR (NEW.payment_verified IS DISTINCT FROM OLD.payment_verified AND NEW.payment_verified = true)
     ) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.store_order_commissions
      WHERE order_id = NEW.id AND status = 'charged'
    ) INTO already_charged;
    IF NOT already_charged THEN
      PERFORM public.wallet_charge_order(NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.wallet_reverse_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_reverse_order_commission(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_reverse_order(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_reverse_order_commission(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.store_upsert_shipment(
  _order_id uuid,
  _slug text,
  _courier_name text,
  _awb text,
  _tracking_url text DEFAULT NULL::text,
  _status text DEFAULT NULL::text,
  _shipment_id uuid DEFAULT NULL::uuid,
  _notify boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid;
  v_id uuid;
  v_order_status text;
  v_current_order_status text;
  v_notify boolean := coalesce(_notify, true);
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

  SELECT o.store_id, o.status INTO v_store, v_current_order_status
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = _order_id AND s.owner_id = auth.uid();

  IF v_store IS NULL THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF v_status = 'returned' THEN
    IF v_current_order_status <> 'shipped' THEN
      RAISE EXCEPTION 'rto_requires_shipped_order';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.parcel_label_scans pls
      WHERE pls.order_id = _order_id
        AND pls.store_id = v_store
        AND pls.decision = 'accepted'
    ) THEN
      RAISE EXCEPTION 'rto_requires_verified_parcel_photo';
    END IF;
  END IF;

  IF _shipment_id IS NOT NULL THEN
    UPDATE public.order_shipments
       SET provider = _slug, tracking_slug = _slug, courier_name = _courier_name,
           awb = btrim(_awb), tracking_url = _tracking_url,
           normalized_status = v_status, status = v_status,
           notify_customer = v_notify,
           is_active = v_status NOT IN ('delivered','returned','cancelled'),
           next_sync_at = now(), sync_attempts = 0, updated_at = now()
     WHERE id = _shipment_id AND store_id = v_store
     RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'shipment not found'; END IF;
  ELSE
    INSERT INTO public.order_shipments (
      order_id, store_id, provider, tracking_slug, courier_name, awb,
      tracking_url, normalized_status, status, is_active, next_sync_at, notify_customer
    ) VALUES (
      _order_id, v_store, _slug, _slug, _courier_name, btrim(_awb),
      _tracking_url, v_status, v_status,
      true, now(), v_notify
    ) RETURNING id INTO v_id;
  END IF;

  INSERT INTO public.shipment_events (shipment_id, store_id, status, raw_status, description, event_time, event_hash)
  VALUES (v_id, v_store, v_status, v_status, 'Status updated by seller', now(), md5(v_id::text || v_status || date_trunc('minute', now())::text))
  ON CONFLICT DO NOTHING;

  v_order_status := CASE
    WHEN v_status = 'delivered' THEN 'delivered'
    WHEN v_status = 'returned' THEN 'rto'
    WHEN v_status = 'cancelled' THEN 'cancelled'
    WHEN v_status IN ('shipped','in_transit','reached_hub','out_for_delivery') THEN 'shipped'
    ELSE NULL
  END;

  UPDATE public.orders
     SET tracking_number = btrim(_awb),
         tracking_url = coalesce(_tracking_url, tracking_url),
         status = CASE
                    WHEN v_order_status IS NULL THEN status
                    WHEN status IN ('cancelled','rto') AND v_order_status NOT IN ('cancelled','rto') THEN status
                    ELSE v_order_status
                  END,
         updated_at = now()
   WHERE id = _order_id;

  RETURN v_id;
END;
$function$;