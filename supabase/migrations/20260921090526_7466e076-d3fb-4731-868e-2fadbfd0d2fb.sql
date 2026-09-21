DROP TRIGGER IF EXISTS trg_lock_cancelled_order_shipments ON public.order_shipments;
CREATE TRIGGER trg_lock_cancelled_order_shipments
BEFORE INSERT ON public.order_shipments
FOR EACH ROW
EXECUTE FUNCTION public.lock_cancelled_order_shipments();