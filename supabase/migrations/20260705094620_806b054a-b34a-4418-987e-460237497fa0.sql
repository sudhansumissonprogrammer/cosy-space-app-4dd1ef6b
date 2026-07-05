
CREATE OR REPLACE FUNCTION public.tg_orders_unrecover_carts_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_phone IS NULL OR NEW.store_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IN ('cancelled','failed','rejected')
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.abandoned_carts ac
       SET recovered = false
     WHERE ac.customer_phone = NEW.customer_phone
       AND ac.store_id = NEW.store_id
       AND ac.recovered = true
       AND ac.recovery_sent_at IS NULL
       AND NOT EXISTS (
         SELECT 1
         FROM public.orders o2
         WHERE o2.customer_phone = NEW.customer_phone
           AND o2.store_id = NEW.store_id
           AND o2.id <> NEW.id
           AND o2.status NOT IN ('cancelled','failed','rejected')
           AND o2.created_at >= ac.created_at - interval '2 hours'
       );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_unrecover_carts_on_cancel ON public.orders;
CREATE TRIGGER trg_orders_unrecover_carts_on_cancel
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_orders_unrecover_carts_on_cancel();

-- Backfill: unmark carts stuck as recovered because their only "matching" order was cancelled/failed/rejected
UPDATE public.abandoned_carts ac
   SET recovered = false
 WHERE ac.recovered = true
   AND ac.recovery_sent_at IS NULL
   AND ac.created_at > now() - interval '24 hours'
   AND ac.customer_phone IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
     FROM public.orders o
     WHERE o.customer_phone = ac.customer_phone
       AND o.store_id = ac.store_id
       AND o.status NOT IN ('cancelled','failed','rejected')
       AND o.created_at >= ac.created_at - interval '2 hours'
   );
