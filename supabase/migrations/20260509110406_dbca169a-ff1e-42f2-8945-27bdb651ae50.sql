
-- ============================================================
-- PHASE 2: Wallet + Withdrawals + Payouts + Notifications
-- ============================================================

-- 1. WALLETS ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_wallets (
  partner_id uuid PRIMARY KEY REFERENCES public.partners(id) ON DELETE CASCADE,
  pending numeric NOT NULL DEFAULT 0,
  approved numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  locked numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner can view own wallet"
ON public.partner_wallets FOR SELECT TO authenticated
USING (public.is_partner_owner(partner_id) OR public.has_role(auth.uid(),'admin'));

-- No INSERT/UPDATE/DELETE policies → only SECURITY DEFINER functions can write.

-- 2. LEDGER -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_wallet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  direction text NOT NULL,  -- credit | debit
  amount numeric NOT NULL CHECK (amount >= 0),
  kind text NOT NULL,       -- commission | reversal | approval | withdrawal_request | withdrawal_paid | withdrawal_refund | adjustment
  bucket_from text,         -- pending | approved | locked | (null for credits)
  bucket_to text,           -- pending | approved | locked | paid | (null for debits)
  commission_id uuid REFERENCES public.partner_commissions(id) ON DELETE SET NULL,
  withdrawal_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwl_partner_created ON public.partner_wallet_ledger(partner_id, created_at DESC);
ALTER TABLE public.partner_wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner can view own ledger"
ON public.partner_wallet_ledger FOR SELECT TO authenticated
USING (public.is_partner_owner(partner_id) OR public.has_role(auth.uid(),'admin'));

-- 3. WITHDRAWALS -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL,           -- upi | bank
  upi_id text,
  bank_account_no text,
  bank_ifsc text,
  bank_account_name text,
  status text NOT NULL DEFAULT 'pending', -- pending | approved | rejected | paid | cancelled
  admin_note text,
  payout_ref text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pw_partner_created ON public.partner_withdrawals(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pw_status ON public.partner_withdrawals(status);

ALTER TABLE public.partner_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner can view own withdrawals"
ON public.partner_withdrawals FOR SELECT TO authenticated
USING (public.is_partner_owner(partner_id) OR public.has_role(auth.uid(),'admin'));

-- now FK from ledger
ALTER TABLE public.partner_wallet_ledger
  DROP CONSTRAINT IF EXISTS partner_wallet_ledger_withdrawal_fk;
ALTER TABLE public.partner_wallet_ledger
  ADD CONSTRAINT partner_wallet_ledger_withdrawal_fk
  FOREIGN KEY (withdrawal_id) REFERENCES public.partner_withdrawals(id) ON DELETE SET NULL;

-- 4. NOTIFICATIONS ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  type text NOT NULL,    -- commission_earned | commission_approved | withdrawal_requested | withdrawal_approved | withdrawal_rejected | withdrawal_paid
  title text NOT NULL,
  body text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pn_partner_unread ON public.partner_notifications(partner_id, read_at NULLS FIRST, created_at DESC);
ALTER TABLE public.partner_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner can view own notifications"
ON public.partner_notifications FOR SELECT TO authenticated
USING (public.is_partner_owner(partner_id) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Partner can mark own notifications read"
ON public.partner_notifications FOR UPDATE TO authenticated
USING (public.is_partner_owner(partner_id))
WITH CHECK (public.is_partner_owner(partner_id));

-- ============================================================
-- WALLET FUNCTIONS (SECURITY DEFINER) -------------------------
-- ============================================================

CREATE OR REPLACE FUNCTION public._ensure_wallet(_partner_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.partner_wallets(partner_id) VALUES (_partner_id)
  ON CONFLICT (partner_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public._notify_partner(_partner_id uuid, _type text, _title text, _body text, _meta jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.partner_notifications(partner_id, type, title, body, metadata)
  VALUES (_partner_id, _type, _title, _body, _meta);
END;
$$;

-- Credit a new commission to PENDING bucket.
CREATE OR REPLACE FUNCTION public.wallet_credit_commission(_commission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.partner_commissions%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.partner_commissions WHERE id = _commission_id;
  IF NOT FOUND THEN RETURN; END IF;

  PERFORM public._ensure_wallet(c.partner_id);

  -- lock wallet row
  PERFORM 1 FROM public.partner_wallets WHERE partner_id = c.partner_id FOR UPDATE;

  UPDATE public.partner_wallets
    SET pending = pending + c.commission_amount, updated_at = now()
    WHERE partner_id = c.partner_id;

  INSERT INTO public.partner_wallet_ledger(partner_id, direction, amount, kind, bucket_to, commission_id, notes)
  VALUES (c.partner_id, 'credit', c.commission_amount, 'commission', 'pending', c.id,
          'Commission earned for payment ' || COALESCE(c.payment_id::text,''));

  PERFORM public._notify_partner(
    c.partner_id, 'commission_earned',
    'New commission earned: ₹' || c.commission_amount::text,
    'A referred store made a payment. Funds will be available after the hold period.',
    jsonb_build_object('commission_id', c.id, 'amount', c.commission_amount)
  );
END;
$$;

-- Move from PENDING → APPROVED after hold period.
CREATE OR REPLACE FUNCTION public.wallet_approve_commission(_commission_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.partner_commissions%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.partner_commissions WHERE id = _commission_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'pending' THEN
    RETURN false;
  END IF;

  PERFORM public._ensure_wallet(c.partner_id);
  PERFORM 1 FROM public.partner_wallets WHERE partner_id = c.partner_id FOR UPDATE;

  UPDATE public.partner_wallets
    SET pending = GREATEST(0, pending - c.commission_amount),
        approved = approved + c.commission_amount,
        updated_at = now()
    WHERE partner_id = c.partner_id;

  UPDATE public.partner_commissions SET status = 'approved' WHERE id = c.id;

  INSERT INTO public.partner_wallet_ledger(partner_id, direction, amount, kind, bucket_from, bucket_to, commission_id, notes)
  VALUES (c.partner_id, 'credit', c.commission_amount, 'approval', 'pending', 'approved', c.id,
          'Commission approved after hold period');

  PERFORM public._notify_partner(
    c.partner_id, 'commission_approved',
    'Commission approved: ₹' || c.commission_amount::text,
    'Funds are now available to withdraw.',
    jsonb_build_object('commission_id', c.id)
  );
  RETURN true;
END;
$$;

-- Reverse on refund.
CREATE OR REPLACE FUNCTION public.wallet_reverse_commission(_commission_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.partner_commissions%ROWTYPE;
  bucket text;
BEGIN
  SELECT * INTO c FROM public.partner_commissions WHERE id = _commission_id FOR UPDATE;
  IF NOT FOUND OR c.status IN ('reversed','paid') THEN
    RETURN false;
  END IF;

  PERFORM public._ensure_wallet(c.partner_id);
  PERFORM 1 FROM public.partner_wallets WHERE partner_id = c.partner_id FOR UPDATE;

  IF c.status = 'pending' THEN
    bucket := 'pending';
    UPDATE public.partner_wallets SET pending = GREATEST(0, pending - c.commission_amount), updated_at = now() WHERE partner_id = c.partner_id;
  ELSIF c.status = 'approved' THEN
    bucket := 'approved';
    UPDATE public.partner_wallets SET approved = GREATEST(0, approved - c.commission_amount), updated_at = now() WHERE partner_id = c.partner_id;
  ELSE
    RETURN false;
  END IF;

  UPDATE public.partner_commissions SET status = 'reversed' WHERE id = c.id;
  UPDATE public.partners SET total_earnings = GREATEST(0, total_earnings - c.commission_amount), updated_at = now() WHERE id = c.partner_id;

  INSERT INTO public.partner_wallet_ledger(partner_id, direction, amount, kind, bucket_from, commission_id, notes)
  VALUES (c.partner_id, 'debit', c.commission_amount, 'reversal', bucket, c.id, 'Commission reversed (refund/chargeback)');

  RETURN true;
END;
$$;

-- Lock approved → locked when withdrawal requested.
CREATE OR REPLACE FUNCTION public.wallet_lock_for_withdrawal(_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.partner_withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO w FROM public.partner_withdrawals WHERE id = _withdrawal_id;
  PERFORM 1 FROM public.partner_wallets WHERE partner_id = w.partner_id FOR UPDATE;

  UPDATE public.partner_wallets
    SET approved = approved - w.amount,
        locked   = locked + w.amount,
        updated_at = now()
    WHERE partner_id = w.partner_id;

  INSERT INTO public.partner_wallet_ledger(partner_id, direction, amount, kind, bucket_from, bucket_to, withdrawal_id, notes)
  VALUES (w.partner_id, 'debit', w.amount, 'withdrawal_request', 'approved', 'locked', w.id, 'Withdrawal requested');
END;
$$;

-- Settle locked → paid after admin marks paid.
CREATE OR REPLACE FUNCTION public.wallet_settle_withdrawal(_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.partner_withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO w FROM public.partner_withdrawals WHERE id = _withdrawal_id;
  PERFORM 1 FROM public.partner_wallets WHERE partner_id = w.partner_id FOR UPDATE;

  UPDATE public.partner_wallets
    SET locked = GREATEST(0, locked - w.amount),
        paid   = paid + w.amount,
        updated_at = now()
    WHERE partner_id = w.partner_id;

  INSERT INTO public.partner_wallet_ledger(partner_id, direction, amount, kind, bucket_from, bucket_to, withdrawal_id, notes)
  VALUES (w.partner_id, 'debit', w.amount, 'withdrawal_paid', 'locked', 'paid', w.id, 'Withdrawal paid out');
END;
$$;

-- Refund locked → approved on rejection/cancel.
CREATE OR REPLACE FUNCTION public.wallet_refund_withdrawal(_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w public.partner_withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO w FROM public.partner_withdrawals WHERE id = _withdrawal_id;
  PERFORM 1 FROM public.partner_wallets WHERE partner_id = w.partner_id FOR UPDATE;

  UPDATE public.partner_wallets
    SET locked = GREATEST(0, locked - w.amount),
        approved = approved + w.amount,
        updated_at = now()
    WHERE partner_id = w.partner_id;

  INSERT INTO public.partner_wallet_ledger(partner_id, direction, amount, kind, bucket_from, bucket_to, withdrawal_id, notes)
  VALUES (w.partner_id, 'credit', w.amount, 'withdrawal_refund', 'locked', 'approved', w.id, 'Withdrawal refunded to balance');
END;
$$;

-- ============================================================
-- TRIGGERS ----------------------------------------------------
-- ============================================================

-- Hook commission insert to wallet credit
CREATE OR REPLACE FUNCTION public.tg_after_commission_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.wallet_credit_commission(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_commission_insert ON public.partner_commissions;
CREATE TRIGGER trg_after_commission_insert
AFTER INSERT ON public.partner_commissions
FOR EACH ROW EXECUTE FUNCTION public.tg_after_commission_insert();

-- Stop commission when plan cancelled: extend create_partner_commission_on_paid
CREATE OR REPLACE FUNCTION public.create_partner_commission_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref public.partner_referrals%ROWTYPE;
  _partner public.partners%ROWTYPE;
  _pct numeric;
  _commission numeric;
  _billing_status text;
BEGIN
  IF NEW.status <> 'paid' THEN RETURN NEW; END IF;
  IF (TG_OP = 'UPDATE') AND OLD.status = 'paid' THEN RETURN NEW; END IF;

  SELECT * INTO _ref FROM public.partner_referrals WHERE store_id = NEW.store_id LIMIT 1;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Stop on cancelled subscription
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
    _partner.id, _ref.id, NEW.store_id, NEW.subscription_id, NEW.id,
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

-- Refund reversal trigger on subscription_payments
CREATE OR REPLACE FUNCTION public.tg_subscription_payment_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_id uuid;
BEGIN
  IF NEW.status = 'refunded' AND COALESCE(OLD.status,'') <> 'refunded' THEN
    SELECT id INTO c_id FROM public.partner_commissions WHERE payment_id = NEW.id;
    IF c_id IS NOT NULL THEN
      PERFORM public.wallet_reverse_commission(c_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_subscription_payment_refund ON public.subscription_payments;
CREATE TRIGGER trg_subscription_payment_refund
AFTER UPDATE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.tg_subscription_payment_refund();

-- updated_at on withdrawals
CREATE TRIGGER trg_partner_withdrawals_updated_at
BEFORE UPDATE ON public.partner_withdrawals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- BACKFILL existing pending commissions into wallets ----------
-- ============================================================
INSERT INTO public.partner_wallets(partner_id, pending)
SELECT partner_id, COALESCE(SUM(commission_amount),0)
FROM public.partner_commissions
WHERE status = 'pending'
GROUP BY partner_id
ON CONFLICT (partner_id) DO UPDATE SET pending = EXCLUDED.pending, updated_at = now();
