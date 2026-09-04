CREATE OR REPLACE FUNCTION public.protect_paid_order_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_was_shipped boolean;
BEGIN
  IF NEW.status = 'cancelled'
     AND COALESCE(OLD.status, '') <> 'cancelled'
     AND COALESCE(OLD.payment_verified, false) = true THEN
    v_was_shipped := OLD.status = 'shipped'
                     OR COALESCE(OLD.tracking_number, '') <> ''
                     OR EXISTS (
                       SELECT 1
                       FROM public.order_shipments sh
                       WHERE sh.order_id = OLD.id
                     );

    IF NOT v_was_shipped THEN
      RAISE EXCEPTION 'cannot_cancel_paid_unshipped_order';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;