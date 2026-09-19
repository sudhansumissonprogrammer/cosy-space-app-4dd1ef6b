CREATE OR REPLACE FUNCTION public.guard_active_shipment_awb()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.awb IS NULL OR btrim(NEW.awb) = '' OR NEW.status IN ('cancelled', 'returned') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.store_id IS NOT DISTINCT FROM OLD.store_id
     AND upper(btrim(NEW.awb)) IS NOT DISTINCT FROM upper(btrim(OLD.awb))
     AND OLD.status NOT IN ('cancelled', 'returned') THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.store_id::text || ':' || upper(btrim(NEW.awb)), 0));
  IF EXISTS (
    SELECT 1 FROM public.order_shipments s
    WHERE s.store_id = NEW.store_id
      AND upper(btrim(s.awb)) = upper(btrim(NEW.awb))
      AND s.status NOT IN ('cancelled', 'returned')
      AND s.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION 'tracking_number_already_used';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_active_shipment_awb() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_active_shipment_awb() TO service_role;
DROP FUNCTION IF EXISTS public.lock_shipment_awb(uuid, text);