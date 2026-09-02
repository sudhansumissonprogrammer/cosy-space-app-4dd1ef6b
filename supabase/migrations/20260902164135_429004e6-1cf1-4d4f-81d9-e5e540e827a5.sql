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
  -- Decide chargeability based on payment method + verification
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

  -- Refund the commission when a SHIPPED order is cancelled.
  -- Scoped deliberately to this single transition.
  IF OLD.status = 'shipped' AND NEW.status = 'cancelled' THEN
    PERFORM public.wallet_reverse_order_commission(
      NEW.id,
      'Order cancelled after shipping — commission refunded'
    );
    RETURN NEW;
  END IF;

  -- UPDATE: charge on transitions into earning state OR when payment becomes verified
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