CREATE OR REPLACE FUNCTION public.wallet_reverse_order_commission(_order_id uuid, _reason text DEFAULT 'Order no longer delivered - commission refunded')
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  c public.store_order_commissions%ROWTYPE;
  new_balance numeric;
  led_id uuid;
BEGIN
  SELECT * INTO c
  FROM public.store_order_commissions
  WHERE order_id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF c.status <> 'charged' OR c.commission_amount <= 0 OR c.reversal_ledger_id IS NOT NULL THEN
    RETURN false;
  END IF;

  PERFORM public._ensure_store_wallet(c.store_id);
  PERFORM 1 FROM public.store_wallets WHERE store_id = c.store_id FOR UPDATE;

  UPDATE public.store_wallets
    SET balance = balance + c.commission_amount,
        total_charged = GREATEST(0, total_charged - c.commission_amount),
        updated_at = now()
    WHERE store_id = c.store_id
    RETURNING balance INTO new_balance;

  INSERT INTO public.store_wallet_ledger
    (store_id, direction, amount, kind, order_id, balance_after, notes)
  VALUES
    (c.store_id, 'credit', c.commission_amount, 'refund', _order_id, new_balance, COALESCE(_reason, 'Order commission refunded'))
  RETURNING id INTO led_id;

  UPDATE public.store_order_commissions
    SET status = 'reversed',
        reversal_ledger_id = led_id,
        updated_at = now()
    WHERE id = c.id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.tg_order_commission_handler()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'delivered' THEN
      PERFORM public.wallet_charge_order(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
      PERFORM public.wallet_charge_order(NEW.id);
    ELSIF OLD.status = 'delivered' AND NEW.status IS DISTINCT FROM 'delivered' THEN
      PERFORM public.wallet_reverse_order_commission(NEW.id, 'Order changed from delivered to ' || NEW.status || ' - commission refunded');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;