CREATE OR REPLACE FUNCTION public.tg_order_commission_handler()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  charged_statuses text[] := ARRAY['confirmed','shipped','delivered','partially_paid'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = ANY(charged_statuses) THEN
      PERFORM public.wallet_charge_order(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: charge once when an order first enters a charged state.
  -- We intentionally do NOT reverse on cancelled/refunded — once commission
  -- has been charged on a real sale, owners cannot reclaim it by editing the
  -- order status. wallet_charge_order is idempotent via store_order_commissions,
  -- so toggling back into a charged status will not double-charge.
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = ANY(charged_statuses) AND NOT (OLD.status = ANY(charged_statuses)) THEN
      PERFORM public.wallet_charge_order(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;