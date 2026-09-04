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
  was_shipped boolean;
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

  -- Refund commission when an order that was SHIPPED (status shipped, or a
  -- tracking number / shipment record exists) is cancelled. Scoped to
  -- cancellation only; nothing else reverses a commission.
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    was_shipped := OLD.status = 'shipped'
                   OR COALESCE(OLD.tracking_number, '') <> ''
                   OR EXISTS (SELECT 1 FROM public.order_shipments sh WHERE sh.order_id = NEW.id);
    IF was_shipped THEN
      PERFORM public.wallet_reverse_order_commission(
        NEW.id,
        'Order cancelled after shipping — commission refunded'
      );
    END IF;
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