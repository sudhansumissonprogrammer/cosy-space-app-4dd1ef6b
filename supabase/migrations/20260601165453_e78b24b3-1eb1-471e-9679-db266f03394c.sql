
-- Add payment_verified to track whether an online payment was actually captured
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz;

-- Backfill: treat existing confirmed/shipped/delivered orders as verified to avoid disrupting history.
-- COD orders are considered "verified" at delivery time (the gating happens differently).
UPDATE public.orders
SET payment_verified = true,
    payment_verified_at = COALESCE(payment_verified_at, updated_at, created_at)
WHERE payment_verified = false
  AND (
    payment_method = 'cod'
    OR status IN ('confirmed','partially_paid','shipped','delivered')
  );

-- Update trigger: only charge commission when payment is genuinely captured.
-- COD: charge on confirmed/shipped/delivered as before (merchant collects cash on delivery).
-- Online (cashfree/razorpay/upi/etc.): require payment_verified = true.
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
