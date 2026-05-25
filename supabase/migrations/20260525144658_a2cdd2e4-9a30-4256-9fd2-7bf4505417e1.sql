
-- 1. Drop redundant auth.uid()-based admin guards inside privileged RPCs.
-- Admin authority is already enforced (a) at the edge function which validates
-- user_roles, and (b) by REVOKEing EXECUTE from authenticated/anon (only the
-- service role can call these). The inner guard breaks calls because
-- auth.uid() is NULL when invoked via the service role.

DROP FUNCTION IF EXISTS public.admin_set_billing_mode(uuid, text);
CREATE OR REPLACE FUNCTION public.admin_set_billing_mode(_store_id uuid, _mode text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _mode NOT IN ('subscription','commission') THEN
    RAISE EXCEPTION 'invalid mode';
  END IF;

  UPDATE public.stores SET billing_mode=_mode, updated_at=now() WHERE id=_store_id;

  IF _mode = 'commission' THEN
    PERFORM public._ensure_store_wallet(_store_id);
    UPDATE public.store_plan_assignments
      SET billing_status='lifetime', grace_period_ends_at=NULL, updated_at=now()
      WHERE store_id=_store_id;
  ELSE
    UPDATE public.store_plan_assignments
      SET billing_status='active', updated_at=now()
      WHERE store_id=_store_id AND billing_status='lifetime';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_set_billing_mode(uuid, text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.wallet_adjust_store(uuid, text, numeric, text);
CREATE OR REPLACE FUNCTION public.wallet_adjust_store(
  _store_id uuid, _direction text, _amount numeric, _note text
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
BEGIN
  IF _direction NOT IN ('credit','debit') THEN RAISE EXCEPTION 'invalid direction'; END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;

  PERFORM public._ensure_store_wallet(_store_id);
  PERFORM 1 FROM public.store_wallets WHERE store_id = _store_id FOR UPDATE;

  IF _direction = 'credit' THEN
    UPDATE public.store_wallets
      SET balance = balance + _amount, updated_at = now()
      WHERE store_id = _store_id
      RETURNING balance INTO new_balance;
    INSERT INTO public.store_wallet_ledger (store_id, direction, amount, kind, balance_after, notes)
      VALUES (_store_id, 'credit', _amount, 'admin_credit', new_balance, COALESCE(_note,'admin credit'));
  ELSE
    UPDATE public.store_wallets
      SET balance = balance - _amount, updated_at = now()
      WHERE store_id = _store_id
      RETURNING balance INTO new_balance;
    INSERT INTO public.store_wallet_ledger (store_id, direction, amount, kind, balance_after, notes)
      VALUES (_store_id, 'debit', _amount, 'admin_debit', new_balance, COALESCE(_note,'admin debit'));
  END IF;

  RETURN new_balance;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.wallet_adjust_store(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;

-- 2. Admin SELECT policies so admin pages can read stores + plan assignments
DROP POLICY IF EXISTS "Admins can view all stores" ON public.stores;
CREATE POLICY "Admins can view all stores"
  ON public.stores FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all plan assignments" ON public.store_plan_assignments;
CREATE POLICY "Admins can view all plan assignments"
  ON public.store_plan_assignments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
