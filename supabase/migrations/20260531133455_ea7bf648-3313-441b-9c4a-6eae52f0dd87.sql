CREATE OR REPLACE FUNCTION public.wallet_charge_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  existing public.store_order_commissions%ROWTYPE;
  had_existing boolean;
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

  SELECT * INTO existing
  FROM public.store_order_commissions
  WHERE order_id = _order_id
  FOR UPDATE;
  had_existing := FOUND;

  IF had_existing AND existing.status IN ('charged', 'skipped_subscription') THEN
    RETURN;
  END IF;

  IF rec.billing_mode <> 'commission' THEN
    IF had_existing THEN
      UPDATE public.store_order_commissions
        SET order_total = COALESCE(rec.total,0),
            percentage = 0,
            commission_amount = 0,
            status = 'skipped_subscription',
            ledger_id = NULL,
            reversal_ledger_id = NULL,
            updated_at = now()
        WHERE id = existing.id;
    ELSE
      INSERT INTO public.store_order_commissions
        (order_id, store_id, order_total, percentage, commission_amount, status)
      VALUES (_order_id, rec.store_id, COALESCE(rec.total,0), 0, 0, 'skipped_subscription')
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
    RETURN;
  END IF;

  PERFORM public._ensure_store_wallet(rec.store_id);

  SELECT commission_percentage INTO pct
  FROM public.store_commission_config WHERE store_id = rec.store_id;
  pct := COALESCE(pct, 3.00);
  commission := ROUND((COALESCE(rec.total,0) * pct / 100)::numeric, 2);

  IF commission <= 0 THEN
    IF had_existing THEN
      UPDATE public.store_order_commissions
        SET order_total = COALESCE(rec.total,0),
            percentage = pct,
            commission_amount = 0,
            status = 'charged',
            ledger_id = NULL,
            reversal_ledger_id = NULL,
            updated_at = now()
        WHERE id = existing.id;
    ELSE
      INSERT INTO public.store_order_commissions
        (order_id, store_id, order_total, percentage, commission_amount, status)
      VALUES (_order_id, rec.store_id, COALESCE(rec.total,0), pct, 0, 'charged')
      ON CONFLICT (order_id) DO NOTHING;
    END IF;
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

  IF had_existing THEN
    UPDATE public.store_order_commissions
      SET order_total = COALESCE(rec.total,0),
          percentage = pct,
          commission_amount = commission,
          status = 'charged',
          ledger_id = led_id,
          reversal_ledger_id = NULL,
          updated_at = now()
      WHERE id = existing.id;
  ELSE
    INSERT INTO public.store_order_commissions
      (order_id, store_id, order_total, percentage, commission_amount, status, ledger_id)
    VALUES (_order_id, rec.store_id, COALESCE(rec.total,0), pct, commission, 'charged', led_id)
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
END;
$function$;

-- Backfill missing idempotency rows for historical debits so they cannot be re-charged
INSERT INTO public.store_order_commissions (order_id, store_id, order_total, percentage, commission_amount, status, ledger_id, created_at, updated_at)
SELECT l.order_id, l.store_id, COALESCE(o.total, l.amount / 0.03), 3.00, l.amount, 'charged', l.id, l.created_at, now()
FROM public.store_wallet_ledger l
LEFT JOIN public.orders o ON o.id = l.order_id
WHERE l.kind = 'order_commission'
  AND l.order_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.store_order_commissions soc WHERE soc.order_id = l.order_id)
ON CONFLICT (order_id) DO NOTHING;