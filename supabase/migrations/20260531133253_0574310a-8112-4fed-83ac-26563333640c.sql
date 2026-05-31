CREATE OR REPLACE FUNCTION public.tg_order_commission_handler()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  earning_statuses text[] := ARRAY['confirmed','shipped','delivered','partially_paid'];
  already_charged boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = ANY(earning_statuses) THEN
      PERFORM public.wallet_charge_order(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NEW.status = ANY(earning_statuses)
     AND NOT (OLD.status = ANY(earning_statuses)) THEN
    SELECT EXISTS (
      SELECT 1 FROM public.store_order_commissions
      WHERE order_id = NEW.id AND status = 'charged'
    ) INTO already_charged;
    IF NOT already_charged THEN
      PERFORM public.wallet_charge_order(NEW.id);
    END IF;
  END IF;
  -- No refunds on any transition.

  RETURN NEW;
END;
$function$;