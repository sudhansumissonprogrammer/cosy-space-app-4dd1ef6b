-- Phase 2 QA fix: harden wallet_lock_for_withdrawal to prevent negative approved balance under race
CREATE OR REPLACE FUNCTION public.wallet_lock_for_withdrawal(_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.partner_withdrawals%ROWTYPE;
  cur_approved numeric;
BEGIN
  SELECT * INTO w FROM public.partner_withdrawals WHERE id = _withdrawal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'withdrawal not found';
  END IF;

  PERFORM public._ensure_wallet(w.partner_id);

  SELECT approved INTO cur_approved
    FROM public.partner_wallets
    WHERE partner_id = w.partner_id
    FOR UPDATE;

  IF cur_approved IS NULL OR cur_approved < w.amount THEN
    RAISE EXCEPTION 'insufficient approved balance';
  END IF;

  UPDATE public.partner_wallets
    SET approved = approved - w.amount,
        locked   = locked + w.amount,
        updated_at = now()
    WHERE partner_id = w.partner_id;

  INSERT INTO public.partner_wallet_ledger(partner_id, direction, amount, kind, bucket_from, bucket_to, withdrawal_id, notes)
  VALUES (w.partner_id, 'debit', w.amount, 'withdrawal_request', 'approved', 'locked', w.id, 'Withdrawal requested');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wallet_lock_for_withdrawal(uuid) FROM PUBLIC, anon, authenticated;