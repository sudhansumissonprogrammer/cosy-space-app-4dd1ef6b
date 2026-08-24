CREATE OR REPLACE FUNCTION public.protect_paid_order_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- A shopper who has actually paid online (payment_verified = true) must never
  -- silently end up as a "Cancelled / ₹0 paid" order. Every writer -- merchant
  -- dashboard dropdown, bulk status change, gateway failure webhooks, crons --
  -- goes through this guard. Genuine refunds should be handled by refunding at
  -- the gateway and marking the order delivered/returned in the notes.
  IF NEW.status = 'cancelled'
     AND COALESCE(OLD.status, '') <> 'cancelled'
     AND COALESCE(OLD.payment_verified, false) = true THEN
    RAISE EXCEPTION 'cannot_cancel_paid_order';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_paid_order_cancellation ON public.orders;
CREATE TRIGGER trg_protect_paid_order_cancellation
BEFORE UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.protect_paid_order_cancellation();

-- Heal the two prepaid orders that were wrongly left in "cancelled".
UPDATE public.orders
SET status = CASE WHEN payment_type = 'partial' THEN 'partially_paid' ELSE 'confirmed' END,
    notes = COALESCE(notes, '') || E'\n[Restored: payment was verified at gateway]'
WHERE id IN (
  'b4343add-6e73-4af5-a83a-7d2d700d5b88',
  '1721f8ef-1177-48cd-99b6-dbb053b508f2'
) AND payment_verified = true AND status = 'cancelled';