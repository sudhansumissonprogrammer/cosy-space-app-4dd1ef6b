
-- ============================================================
-- Commission-based billing + store wallet
-- ============================================================

-- 1. Add billing_mode to stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'subscription';

ALTER TABLE public.stores
  DROP CONSTRAINT IF EXISTS stores_billing_mode_check;
ALTER TABLE public.stores
  ADD CONSTRAINT stores_billing_mode_check
  CHECK (billing_mode IN ('subscription','commission'));

CREATE INDEX IF NOT EXISTS idx_stores_billing_mode ON public.stores(billing_mode);

-- 2. store_commission_config
CREATE TABLE IF NOT EXISTS public.store_commission_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  commission_percentage numeric NOT NULL DEFAULT 3.00,
  min_recharge numeric NOT NULL DEFAULT 700,
  low_balance_threshold numeric NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_commission_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage commission config" ON public.store_commission_config;
CREATE POLICY "Admins manage commission config"
  ON public.store_commission_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Store owner views commission config" ON public.store_commission_config;
CREATE POLICY "Store owner views commission config"
  ON public.store_commission_config FOR SELECT
  USING (public.is_store_owner(store_id));

CREATE TRIGGER trg_commission_config_updated_at
  BEFORE UPDATE ON public.store_commission_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. store_wallets
CREATE TABLE IF NOT EXISTS public.store_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL UNIQUE REFERENCES public.stores(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  total_recharged numeric NOT NULL DEFAULT 0,
  total_charged numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage wallets" ON public.store_wallets;
CREATE POLICY "Admins manage wallets"
  ON public.store_wallets FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner views own wallet" ON public.store_wallets;
CREATE POLICY "Owner views own wallet"
  ON public.store_wallets FOR SELECT
  USING (public.is_store_owner(store_id));

-- 4. store_wallet_recharges
CREATE TABLE IF NOT EXISTS public.store_wallet_recharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  cashfree_order_id text NOT NULL UNIQUE,
  cashfree_payment_id text UNIQUE,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  paid_at timestamptz,
  raw_payload jsonb,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_recharges_store ON public.store_wallet_recharges(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_recharges_status ON public.store_wallet_recharges(status);

ALTER TABLE public.store_wallet_recharges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage wallet recharges" ON public.store_wallet_recharges;
CREATE POLICY "Admins manage wallet recharges"
  ON public.store_wallet_recharges FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner views own recharges" ON public.store_wallet_recharges;
CREATE POLICY "Owner views own recharges"
  ON public.store_wallet_recharges FOR SELECT
  USING (public.is_store_owner(store_id));

-- 5. store_wallet_ledger (immutable audit)
CREATE TABLE IF NOT EXISTS public.store_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('credit','debit')),
  amount numeric NOT NULL CHECK (amount > 0),
  kind text NOT NULL CHECK (kind IN ('recharge','order_commission','refund','admin_adjustment')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  recharge_id uuid REFERENCES public.store_wallet_recharges(id) ON DELETE SET NULL,
  balance_after numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_store ON public.store_wallet_ledger(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_ledger_order ON public.store_wallet_ledger(order_id);

ALTER TABLE public.store_wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all ledger" ON public.store_wallet_ledger;
CREATE POLICY "Admins view all ledger"
  ON public.store_wallet_ledger FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner views own ledger" ON public.store_wallet_ledger;
CREATE POLICY "Owner views own ledger"
  ON public.store_wallet_ledger FOR SELECT
  USING (public.is_store_owner(store_id));
-- no insert/update/delete policies — only SECURITY DEFINER functions write

-- 6. store_order_commissions
CREATE TABLE IF NOT EXISTS public.store_order_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  order_total numeric NOT NULL,
  percentage numeric NOT NULL,
  commission_amount numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('charged','reversed','skipped_subscription')),
  ledger_id uuid REFERENCES public.store_wallet_ledger(id) ON DELETE SET NULL,
  reversal_ledger_id uuid REFERENCES public.store_wallet_ledger(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_commissions_store ON public.store_order_commissions(store_id, created_at DESC);

ALTER TABLE public.store_order_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view commissions" ON public.store_order_commissions;
CREATE POLICY "Admins view commissions"
  ON public.store_order_commissions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owner views own commissions" ON public.store_order_commissions;
CREATE POLICY "Owner views own commissions"
  ON public.store_order_commissions FOR SELECT
  USING (public.is_store_owner(store_id));

-- 7. Helper: is_store_commission_mode
DROP FUNCTION IF EXISTS public.is_store_commission_mode(uuid);
CREATE OR REPLACE FUNCTION public.is_store_commission_mode(_store_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id AND billing_mode = 'commission'
  );
$$;

-- 8. Helper: ensure wallet + config rows exist
DROP FUNCTION IF EXISTS public._ensure_store_wallet(uuid);
CREATE OR REPLACE FUNCTION public._ensure_store_wallet(_store_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.store_wallets(store_id) VALUES (_store_id)
  ON CONFLICT (store_id) DO NOTHING;
  INSERT INTO public.store_commission_config(store_id) VALUES (_store_id)
  ON CONFLICT (store_id) DO NOTHING;
END;
$$;

-- 9. Apply recharge (called by Cashfree verify/webhook)
DROP FUNCTION IF EXISTS public.wallet_apply_recharge(uuid);
CREATE OR REPLACE FUNCTION public.wallet_apply_recharge(_recharge_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.store_wallet_recharges%ROWTYPE;
  new_balance numeric;
  led_id uuid;
BEGIN
  SELECT * INTO r FROM public.store_wallet_recharges WHERE id = _recharge_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.status = 'paid' THEN RETURN false; END IF;
  IF r.status <> 'pending' THEN RETURN false; END IF;

  PERFORM public._ensure_store_wallet(r.store_id);
  PERFORM 1 FROM public.store_wallets WHERE store_id = r.store_id FOR UPDATE;

  UPDATE public.store_wallets
    SET balance = balance + r.amount,
        total_recharged = total_recharged + r.amount,
        updated_at = now()
    WHERE store_id = r.store_id
    RETURNING balance INTO new_balance;

  INSERT INTO public.store_wallet_ledger
    (store_id, direction, amount, kind, recharge_id, balance_after, notes)
  VALUES
    (r.store_id, 'credit', r.amount, 'recharge', r.id, new_balance,
     'Wallet recharge via Cashfree (' || r.cashfree_order_id || ')')
  RETURNING id INTO led_id;

  UPDATE public.store_wallet_recharges
    SET status = 'paid', paid_at = COALESCE(paid_at, now()), updated_at = now()
    WHERE id = r.id;

  RETURN true;
END;
$$;

-- 10. Charge wallet for order
DROP FUNCTION IF EXISTS public.wallet_charge_order(uuid);
CREATE OR REPLACE FUNCTION public.wallet_charge_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o RECORD;
  pct numeric;
  commission numeric;
  new_balance numeric;
  led_id uuid;
  mode text;
BEGIN
  SELECT o.id, o.store_id, o.total, s.billing_mode
    INTO o
  FROM public.orders o
  JOIN public.stores s ON s.id = o.store_id
  WHERE o.id = _order_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Idempotent
  IF EXISTS (SELECT 1 FROM public.store_order_commissions WHERE order_id = _order_id) THEN
    RETURN;
  END IF;

  IF o.billing_mode <> 'commission' THEN
    INSERT INTO public.store_order_commissions
      (order_id, store_id, order_total, percentage, commission_amount, status)
    VALUES (_order_id, o.store_id, COALESCE(o.total,0), 0, 0, 'skipped_subscription')
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  PERFORM public._ensure_store_wallet(o.store_id);

  SELECT commission_percentage INTO pct
  FROM public.store_commission_config WHERE store_id = o.store_id;
  pct := COALESCE(pct, 3.00);
  commission := ROUND((COALESCE(o.total,0) * pct / 100)::numeric, 2);
  IF commission <= 0 THEN
    INSERT INTO public.store_order_commissions
      (order_id, store_id, order_total, percentage, commission_amount, status)
    VALUES (_order_id, o.store_id, COALESCE(o.total,0), pct, 0, 'charged')
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  PERFORM 1 FROM public.store_wallets WHERE store_id = o.store_id FOR UPDATE;

  UPDATE public.store_wallets
    SET balance = balance - commission,
        total_charged = total_charged + commission,
        updated_at = now()
    WHERE store_id = o.store_id
    RETURNING balance INTO new_balance;

  INSERT INTO public.store_wallet_ledger
    (store_id, direction, amount, kind, order_id, balance_after, notes)
  VALUES
    (o.store_id, 'debit', commission, 'order_commission', _order_id, new_balance,
     'Commission ' || pct::text || '% on order ' || _order_id::text)
  RETURNING id INTO led_id;

  INSERT INTO public.store_order_commissions
    (order_id, store_id, order_total, percentage, commission_amount, status, ledger_id)
  VALUES (_order_id, o.store_id, COALESCE(o.total,0), pct, commission, 'charged', led_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- 11. Reverse wallet charge for order
DROP FUNCTION IF EXISTS public.wallet_reverse_order(uuid);
CREATE OR REPLACE FUNCTION public.wallet_reverse_order(_order_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.store_order_commissions%ROWTYPE;
  new_balance numeric;
  led_id uuid;
BEGIN
  SELECT * INTO c FROM public.store_order_commissions WHERE order_id = _order_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF c.status <> 'charged' THEN RETURN; END IF;
  IF c.commission_amount <= 0 THEN
    UPDATE public.store_order_commissions SET status='reversed', updated_at=now() WHERE id=c.id;
    RETURN;
  END IF;

  PERFORM 1 FROM public.store_wallets WHERE store_id = c.store_id FOR UPDATE;
  UPDATE public.store_wallets
    SET balance = balance + c.commission_amount,
        total_charged = GREATEST(0, total_charged - c.commission_amount),
        updated_at = now()
    WHERE store_id = c.store_id
    RETURNING balance INTO new_balance;

  INSERT INTO public.store_wallet_ledger
    (store_id, direction, amount, kind, order_id, balance_after, notes)
  VALUES (c.store_id, 'credit', c.commission_amount, 'refund', _order_id, new_balance,
          'Reversed commission for order ' || _order_id::text)
  RETURNING id INTO led_id;

  UPDATE public.store_order_commissions
    SET status='reversed', reversal_ledger_id=led_id, updated_at=now()
    WHERE id=c.id;
END;
$$;

-- 12. Admin manual adjustment
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
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;
  IF _direction NOT IN ('credit','debit') THEN RAISE EXCEPTION 'invalid direction'; END IF;

  PERFORM public._ensure_store_wallet(_store_id);
  PERFORM 1 FROM public.store_wallets WHERE store_id = _store_id FOR UPDATE;

  IF _direction = 'credit' THEN
    UPDATE public.store_wallets
      SET balance = balance + _amount, updated_at=now()
      WHERE store_id=_store_id
      RETURNING balance INTO new_balance;
  ELSE
    UPDATE public.store_wallets
      SET balance = balance - _amount, updated_at=now()
      WHERE store_id=_store_id
      RETURNING balance INTO new_balance;
  END IF;

  INSERT INTO public.store_wallet_ledger
    (store_id, direction, amount, kind, balance_after, notes)
  VALUES (_store_id, _direction, _amount, 'admin_adjustment', new_balance,
          COALESCE(_note,'Admin adjustment'));

  RETURN new_balance;
END;
$$;

-- 13. Switch billing mode (admin only)
DROP FUNCTION IF EXISTS public.admin_set_billing_mode(uuid, text);
CREATE OR REPLACE FUNCTION public.admin_set_billing_mode(_store_id uuid, _mode text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF _mode NOT IN ('subscription','commission') THEN RAISE EXCEPTION 'invalid mode'; END IF;

  UPDATE public.stores SET billing_mode=_mode, updated_at=now() WHERE id=_store_id;

  IF _mode = 'commission' THEN
    PERFORM public._ensure_store_wallet(_store_id);
    -- Park subscription billing so cron / paywall ignores the store
    UPDATE public.store_plan_assignments
      SET billing_status='lifetime', grace_period_ends_at=NULL, updated_at=now()
      WHERE store_id=_store_id;
  ELSE
    -- Going back to subscription: reset to active (admin should review billing manually)
    UPDATE public.store_plan_assignments
      SET billing_status='active', updated_at=now()
      WHERE store_id=_store_id AND billing_status='lifetime';
  END IF;
END;
$$;

-- 14. Trigger: charge / reverse on order status changes
CREATE OR REPLACE FUNCTION public.tg_order_commission_handler()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  charged_statuses text[] := ARRAY['confirmed','shipped','delivered','partially_paid'];
  reversed_statuses text[] := ARRAY['cancelled','refunded'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = ANY(charged_statuses) THEN
      PERFORM public.wallet_charge_order(NEW.id);
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = ANY(charged_statuses) AND NOT (OLD.status = ANY(charged_statuses)) THEN
      PERFORM public.wallet_charge_order(NEW.id);
    ELSIF NEW.status = ANY(reversed_statuses) AND OLD.status = ANY(charged_statuses) THEN
      PERFORM public.wallet_reverse_order(NEW.id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_commission ON public.orders;
CREATE TRIGGER trg_order_commission
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_order_commission_handler();

-- 15. Skip partner commission on commission-mode stores
CREATE OR REPLACE FUNCTION public.create_partner_commission_on_paid()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref public.partner_referrals%ROWTYPE;
  _partner public.partners%ROWTYPE;
  _pct numeric;
  _commission numeric;
  _billing_status text;
  _mode text;
BEGIN
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
  IF (TG_OP = 'UPDATE') AND OLD.status = 'paid' THEN RETURN NEW; END IF;

  SELECT billing_mode INTO _mode FROM public.stores WHERE id = NEW.store_id;
  IF _mode = 'commission' THEN
    RETURN NEW; -- commission-mode stores are not eligible for partner referral
  END IF;

  SELECT * INTO _ref FROM public.partner_referrals WHERE store_id = NEW.store_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT billing_status INTO _billing_status FROM public.store_plan_assignments WHERE store_id = NEW.store_id LIMIT 1;
  IF _billing_status = 'cancelled' THEN RETURN NEW; END IF;

  SELECT * INTO _partner FROM public.partners WHERE id = _ref.partner_id;
  IF NOT FOUND OR _partner.status <> 'active' THEN RETURN NEW; END IF;

  _pct := COALESCE(_partner.commission_percentage, 40);
  _commission := ROUND((NEW.amount * _pct / 100)::numeric, 2);

  INSERT INTO public.partner_commissions (
    partner_id, referral_id, store_id, subscription_id, payment_id,
    amount_paid, percentage, commission_amount, status
  ) VALUES (
    _partner.id, _ref.id, NEW.store_id, NULL, NEW.id,
    NEW.amount, _pct, _commission, 'pending'
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.partner_referrals
    SET status = 'paid', locked = true, first_paid_at = COALESCE(first_paid_at, now())
    WHERE id = _ref.id;

  UPDATE public.partners
    SET total_earnings = total_earnings + _commission, updated_at = now()
    WHERE id = _partner.id;

  RETURN NEW;
END;
$$;

-- 16. Owner-facing wallet summary RPC (single call for dashboard)
DROP FUNCTION IF EXISTS public.get_store_wallet_summary(uuid);
CREATE OR REPLACE FUNCTION public.get_store_wallet_summary(_store_id uuid)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_build_object(
    'wallet', (SELECT row_to_json(w) FROM public.store_wallets w WHERE w.store_id = _store_id),
    'config', (SELECT row_to_json(c) FROM public.store_commission_config c WHERE c.store_id = _store_id),
    'billing_mode', (SELECT billing_mode FROM public.stores WHERE id = _store_id),
    'ledger', COALESCE((
      SELECT json_agg(l ORDER BY l.created_at DESC) FROM (
        SELECT * FROM public.store_wallet_ledger
        WHERE store_id = _store_id
        ORDER BY created_at DESC LIMIT 50
      ) l
    ), '[]'::json),
    'recharges', COALESCE((
      SELECT json_agg(r ORDER BY r.created_at DESC) FROM (
        SELECT * FROM public.store_wallet_recharges
        WHERE store_id = _store_id
        ORDER BY created_at DESC LIMIT 20
      ) r
    ), '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;
