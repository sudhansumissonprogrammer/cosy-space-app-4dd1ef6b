
CREATE OR REPLACE FUNCTION public.wallet_reverse_order_commission(_order_id uuid, _reason text DEFAULT 'Order no longer delivered - commission refunded'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  c public.store_order_commissions%ROWTYPE;
  new_balance numeric;
  led_id uuid;
  onum text;
  note text;
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

  SELECT o.order_number::text INTO onum FROM public.orders o WHERE o.id = _order_id;

  note := 'Commission refunded — order #' || COALESCE(onum, '-')
          || ' (' || trim(to_char(COALESCE(c.percentage,0), 'FM999990.00')) || '% of ₹'
          || trim(to_char(COALESCE(c.order_total,0), 'FM999999990.00')) || ')';
  IF _reason IS NOT NULL AND _reason <> '' THEN
    note := note || ' — ' || _reason;
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
    (c.store_id, 'credit', c.commission_amount, 'refund', _order_id, new_balance, note)
  RETURNING id INTO led_id;

  UPDATE public.store_order_commissions
    SET status = 'reversed',
        reversal_ledger_id = led_id,
        updated_at = now()
    WHERE id = c.id;

  RETURN true;
END;
$function$;

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
  SELECT o.id AS id, o.store_id AS store_id, o.total AS total, o.order_number AS order_number, s.billing_mode AS billing_mode
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
     'Commission ' || trim(to_char(pct, 'FM999990.00')) || '% — order #' || COALESCE(rec.order_number::text,'-')
     || ' (₹' || trim(to_char(COALESCE(rec.total,0), 'FM999999990.00')) || ')')
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

-- Backfill readable notes on existing wallet history
UPDATE public.store_wallet_ledger l
SET notes = 'Commission ' || trim(to_char(COALESCE(c.percentage,3), 'FM999990.00')) || '% — order #'
            || COALESCE(o.order_number::text,'-')
            || ' (₹' || trim(to_char(COALESCE(o.total,0), 'FM999999990.00')) || ')'
FROM public.orders o
LEFT JOIN public.store_order_commissions c ON c.order_id = o.id
WHERE l.order_id = o.id
  AND l.kind = 'order_commission'
  AND l.notes LIKE '%on order %-%-%';

UPDATE public.store_wallet_ledger l
SET notes = 'Commission refunded — order #' || COALESCE(o.order_number::text,'-')
            || ' (' || trim(to_char(COALESCE(c.percentage,3), 'FM999990.00')) || '% of ₹'
            || trim(to_char(COALESCE(o.total,0), 'FM999999990.00')) || ')'
            || CASE WHEN l.notes IS NOT NULL AND l.notes <> '' THEN ' — ' || l.notes ELSE '' END
FROM public.orders o
LEFT JOIN public.store_order_commissions c ON c.order_id = o.id
WHERE l.order_id = o.id
  AND l.kind = 'refund'
  AND l.notes NOT LIKE 'Commission refunded — order #%';
