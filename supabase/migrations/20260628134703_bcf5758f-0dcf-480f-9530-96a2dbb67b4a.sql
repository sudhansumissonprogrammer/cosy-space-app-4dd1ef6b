CREATE OR REPLACE FUNCTION public.wallet_adjust_store(_store_id uuid, _direction text, _amount numeric, _note text)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_balance numeric;
BEGIN
  IF _direction NOT IN ('credit','debit') THEN RAISE EXCEPTION 'invalid direction'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;

  PERFORM public._ensure_store_wallet(_store_id);
  PERFORM 1 FROM public.store_wallets WHERE store_id = _store_id FOR UPDATE;

  IF _direction = 'credit' THEN
    UPDATE public.store_wallets
      SET balance = balance + _amount,
          total_recharged = total_recharged + _amount,
          updated_at = now()
      WHERE store_id = _store_id
      RETURNING balance INTO new_balance;
    INSERT INTO public.store_wallet_ledger (store_id, direction, amount, kind, balance_after, notes)
      VALUES (_store_id, 'credit', _amount, 'admin_adjustment', new_balance, COALESCE(_note,'admin credit'));
  ELSE
    UPDATE public.store_wallets
      SET balance = balance - _amount,
          total_charged = total_charged + _amount,
          updated_at = now()
      WHERE store_id = _store_id
      RETURNING balance INTO new_balance;
    INSERT INTO public.store_wallet_ledger (store_id, direction, amount, kind, balance_after, notes)
      VALUES (_store_id, 'debit', _amount, 'admin_adjustment', new_balance, COALESCE(_note,'admin debit'));
  END IF;

  RETURN new_balance;
END;
$function$;