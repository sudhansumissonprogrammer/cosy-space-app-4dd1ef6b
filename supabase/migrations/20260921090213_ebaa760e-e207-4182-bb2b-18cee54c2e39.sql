CREATE OR REPLACE FUNCTION public.lock_cancelled_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'cancelled_order_is_locked';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.lock_cancelled_order_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_cancelled_order_status() TO service_role;

DROP TRIGGER IF EXISTS trg_lock_cancelled_order_status ON public.orders;
CREATE TRIGGER trg_lock_cancelled_order_status
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.lock_cancelled_order_status();

CREATE OR REPLACE FUNCTION public.lock_cancelled_order_shipments()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_order_id uuid := COALESCE(NEW.order_id, OLD.order_id);
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = v_order_id AND o.status = 'cancelled'
  ) THEN
    RAISE EXCEPTION 'cancelled_order_is_locked';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$function$;

REVOKE ALL ON FUNCTION public.lock_cancelled_order_shipments() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_cancelled_order_shipments() TO service_role;

DROP TRIGGER IF EXISTS trg_lock_cancelled_order_shipments ON public.order_shipments;
CREATE TRIGGER trg_lock_cancelled_order_shipments
BEFORE INSERT OR UPDATE OR DELETE ON public.order_shipments
FOR EACH ROW
EXECUTE FUNCTION public.lock_cancelled_order_shipments();