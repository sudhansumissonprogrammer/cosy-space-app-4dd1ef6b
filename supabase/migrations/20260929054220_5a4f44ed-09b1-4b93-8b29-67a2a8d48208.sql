CREATE OR REPLACE FUNCTION public.lock_cancelled_order_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'cancelled' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- Only exception: the payment system (service role) recovering an order
    -- the gateway confirms was actually paid.
    IF COALESCE(auth.role(), current_setting('role', true)) = 'service_role'
       AND NEW.status IN ('confirmed','partially_paid')
       AND NEW.payment_verified IS TRUE
       AND OLD.payment_verified IS NOT TRUE THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'cancelled_order_is_locked';
  END IF;
  RETURN NEW;
END;
$$;