
-- ============ 1. New tables ============

CREATE TABLE IF NOT EXISTS public.partner_commission_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.plans(id) ON DELETE CASCADE,
  percentage numeric(5,2) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  starts_at timestamptz,
  ends_at timestamptz,
  note text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pco_partner ON public.partner_commission_overrides(partner_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pco_plan ON public.partner_commission_overrides(plan_id);

ALTER TABLE public.partner_commission_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage overrides" ON public.partner_commission_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "partners read own overrides" ON public.partner_commission_overrides
  FOR SELECT TO authenticated
  USING (public.is_partner_owner(partner_id));

CREATE TABLE IF NOT EXISTS public.partner_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_role text,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  old_value jsonb,
  new_value jsonb,
  note text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pal_target ON public.partner_audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_actor ON public.partner_audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pal_action ON public.partner_audit_logs(action, created_at DESC);

ALTER TABLE public.partner_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read audit" ON public.partner_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.webhook_events (
  provider text NOT NULL,
  event_id text NOT NULL,
  payload jsonb,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, event_id)
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read webhook events" ON public.webhook_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.partner_rate_limits (
  partner_id uuid NOT NULL,
  action text NOT NULL,
  last_at timestamptz NOT NULL DEFAULT now(),
  count int NOT NULL DEFAULT 1,
  PRIMARY KEY (partner_id, action)
);
ALTER TABLE public.partner_rate_limits ENABLE ROW LEVEL SECURITY;
-- no policies — only SECURITY DEFINER functions touch this table

-- ============ 2. New columns ============

ALTER TABLE public.partners
  ADD COLUMN IF NOT EXISTS payouts_paused boolean NOT NULL DEFAULT false;

-- ============ 3. Helper functions ============

CREATE OR REPLACE FUNCTION public.resolve_partner_commission_pct(
  _partner_id uuid,
  _store_id uuid
) RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _plan_id uuid;
  _pct numeric;
  _partner_pct numeric;
BEGIN
  SELECT plan_id INTO _plan_id FROM public.store_plan_assignments WHERE store_id = _store_id LIMIT 1;

  -- 1. plan-specific override
  IF _plan_id IS NOT NULL THEN
    SELECT percentage INTO _pct
    FROM public.partner_commission_overrides
    WHERE partner_id = _partner_id
      AND plan_id = _plan_id
      AND is_active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
    ORDER BY created_at DESC LIMIT 1;
    IF _pct IS NOT NULL THEN RETURN _pct; END IF;
  END IF;

  -- 2. global partner override
  SELECT percentage INTO _pct
  FROM public.partner_commission_overrides
  WHERE partner_id = _partner_id
    AND plan_id IS NULL
    AND is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  ORDER BY created_at DESC LIMIT 1;
  IF _pct IS NOT NULL THEN RETURN _pct; END IF;

  -- 3. partner default
  SELECT commission_percentage INTO _partner_pct FROM public.partners WHERE id = _partner_id;
  RETURN COALESCE(_partner_pct, 40);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_partner_audit(
  _action text,
  _target_type text,
  _target_id uuid,
  _old jsonb,
  _new jsonb,
  _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _id uuid;
  _role text;
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN _role := 'admin';
  ELSE _role := 'user'; END IF;
  INSERT INTO public.partner_audit_logs(actor_user_id, actor_role, action, target_type, target_id, old_value, new_value, note)
  VALUES (auth.uid(), _role, _action, _target_type, _target_id, _old, _new, _note)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.wallet_adjust(
  _partner_id uuid,
  _direction text,    -- 'credit' | 'debit'
  _bucket text,       -- 'pending' | 'approved'
  _amount numeric,
  _note text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;
  IF _direction NOT IN ('credit','debit') THEN RAISE EXCEPTION 'invalid direction'; END IF;
  IF _bucket NOT IN ('pending','approved') THEN RAISE EXCEPTION 'invalid bucket'; END IF;

  PERFORM public._ensure_wallet(_partner_id);
  PERFORM 1 FROM public.partner_wallets WHERE partner_id = _partner_id FOR UPDATE;

  IF _bucket = 'pending' THEN
    IF _direction = 'credit' THEN
      UPDATE public.partner_wallets SET pending = pending + _amount, updated_at=now() WHERE partner_id=_partner_id;
    ELSE
      UPDATE public.partner_wallets SET pending = GREATEST(0, pending - _amount), updated_at=now() WHERE partner_id=_partner_id;
    END IF;
  ELSE
    IF _direction = 'credit' THEN
      UPDATE public.partner_wallets SET approved = approved + _amount, updated_at=now() WHERE partner_id=_partner_id;
    ELSE
      UPDATE public.partner_wallets SET approved = GREATEST(0, approved - _amount), updated_at=now() WHERE partner_id=_partner_id;
    END IF;
  END IF;

  INSERT INTO public.partner_wallet_ledger(partner_id, direction, amount, kind, bucket_to, notes)
  VALUES (_partner_id, _direction, _amount, 'adjustment',
          CASE WHEN _direction='credit' THEN _bucket ELSE NULL END,
          COALESCE(_note,'Admin adjustment'));

  PERFORM public.log_partner_audit('wallet_adjustment', 'partner', _partner_id, NULL,
    jsonb_build_object('direction',_direction,'bucket',_bucket,'amount',_amount), _note);

  PERFORM public._notify_partner(_partner_id, 'wallet_adjustment',
    'Wallet ' || _direction || ' ₹' || _amount::text,
    COALESCE(_note,'Manual adjustment by admin'),
    jsonb_build_object('direction',_direction,'bucket',_bucket,'amount',_amount));
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_adjust(uuid,text,text,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_adjust(uuid,text,text,numeric,text) TO service_role;

-- ============ 4. Update commission trigger to use override engine ============

CREATE OR REPLACE FUNCTION public.create_partner_commission_on_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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

  SELECT billing_status INTO _billing_status FROM public.store_plan_assignments WHERE store_id = NEW.store_id LIMIT 1;
  IF _billing_status = 'cancelled' THEN RETURN NEW; END IF;

  SELECT * INTO _partner FROM public.partners WHERE id = _ref.partner_id;
  IF NOT FOUND OR _partner.status <> 'active' THEN RETURN NEW; END IF;

  _pct := public.resolve_partner_commission_pct(_partner.id, NEW.store_id);
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

-- ============ 5. Performance indexes ============

CREATE INDEX IF NOT EXISTS idx_pc_partner_status_created ON public.partner_commissions(partner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pwl_partner_created ON public.partner_wallet_ledger(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pw_partner_status_created ON public.partner_withdrawals(partner_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pr_partner_status ON public.partner_referrals(partner_id, status);
CREATE INDEX IF NOT EXISTS idx_pr_store ON public.partner_referrals(store_id);
CREATE INDEX IF NOT EXISTS idx_prc_partner_created ON public.partner_referral_clicks(partner_id, created_at DESC);

-- ============ 6. Realtime ============

ALTER TABLE public.partner_referral_clicks REPLICA IDENTITY FULL;
ALTER TABLE public.partner_referrals REPLICA IDENTITY FULL;
ALTER TABLE public.partner_commissions REPLICA IDENTITY FULL;
ALTER TABLE public.partner_wallet_ledger REPLICA IDENTITY FULL;
ALTER TABLE public.partner_notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='partner_referral_clicks';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_referral_clicks; END IF;

  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='partner_referrals';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_referrals; END IF;

  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='partner_commissions';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_commissions; END IF;

  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='partner_wallet_ledger';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_wallet_ledger; END IF;

  PERFORM 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='partner_notifications';
  IF NOT FOUND THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_notifications; END IF;
END$$;
