CREATE OR REPLACE FUNCTION public.wallet_charge_order(_order_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  pct numeric;
  commission numeric;
  new_balance numeric;
  led_id uuid;
BEGIN
  SELECT o.id AS id, o.store_id AS store_id, o.total AS total, s.billing_mode AS billing_mode
    INTO rec
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = _order_id;
  IF NOT FOUND THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM public.store_order_commissions WHERE order_id = _order_id) THEN
    RETURN;
  END IF;

  IF rec.billing_mode <> 'commission' THEN
    INSERT INTO public.store_order_commissions
      (order_id, store_id, order_total, percentage, commission_amount, status)
    VALUES (_order_id, rec.store_id, COALESCE(rec.total,0), 0, 0, 'skipped_subscription')
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  PERFORM public._ensure_store_wallet(rec.store_id);

  SELECT commission_percentage INTO pct
  FROM public.store_commission_config WHERE store_id = rec.store_id;
  pct := COALESCE(pct, 3.00);
  commission := ROUND((COALESCE(rec.total,0) * pct / 100)::numeric, 2);
  IF commission <= 0 THEN
    INSERT INTO public.store_order_commissions
      (order_id, store_id, order_total, percentage, commission_amount, status)
    VALUES (_order_id, rec.store_id, COALESCE(rec.total,0), pct, 0, 'charged')
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  PERFORM 1 FROM public.store_wallets WHERE store_id = rec.store_id FOR UPDATE;

  UPDATE public.store_wallets
    SET balance = balance - commission,
        total_charged = total_charged + commission,
        updated_at = now()
    WHERE store_id = rec.store_id
    RETURNING balance INTO new_balance;

  INSERT INTO public.store_wallet_ledger
    (store_id, direction, amount, kind, order_id, balance_after, notes)
  VALUES
    (rec.store_id, 'debit', commission, 'order_commission', _order_id, new_balance,
     'Commission ' || pct::text || '% on order ' || _order_id::text)
  RETURNING id INTO led_id;

  INSERT INTO public.store_order_commissions
    (order_id, store_id, order_total, percentage, commission_amount, status, ledger_id)
  VALUES (_order_id, rec.store_id, COALESCE(rec.total,0), pct, commission, 'charged', led_id)
  ON CONFLICT DO NOTHING;
END;
$function$;