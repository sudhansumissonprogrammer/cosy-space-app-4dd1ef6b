
-- 1. Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner';

-- 2. Helper: generate sequential partner code SBP1000+
CREATE SEQUENCE IF NOT EXISTS public.partner_code_seq START WITH 1000;

CREATE OR REPLACE FUNCTION public.generate_partner_code()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT 'SBP' || nextval('public.partner_code_seq')::text;
$$;

-- 3. partners table
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_code text NOT NULL UNIQUE DEFAULT public.generate_partner_code(),
  name text NOT NULL,
  email text NOT NULL,
  mobile text,
  commission_percentage numeric NOT NULL DEFAULT 40,
  status text NOT NULL DEFAULT 'active',
  total_earnings numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partners can view own row"
  ON public.partners FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Partners can update own row"
  ON public.partners FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Partners can insert own row"
  ON public.partners FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins manage partners"
  ON public.partners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_partners_partner_code ON public.partners(partner_code);

-- 4. helper fn
CREATE OR REPLACE FUNCTION public.is_partner_owner(_partner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.partners
    WHERE id = _partner_id AND user_id = auth.uid()
  );
$$;

-- 5. partner_referral_clicks
CREATE TABLE IF NOT EXISTS public.partner_referral_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  ip text,
  user_agent text,
  referrer text,
  landing_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_referral_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert clicks"
  ON public.partner_referral_clicks FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Partner views own clicks"
  ON public.partner_referral_clicks FOR SELECT TO authenticated
  USING (public.is_partner_owner(partner_id));

CREATE POLICY "Admins manage clicks"
  ON public.partner_referral_clicks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_clicks_partner ON public.partner_referral_clicks(partner_id, created_at DESC);

-- 6. partner_referrals
CREATE TABLE IF NOT EXISTS public.partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id uuid,
  status text NOT NULL DEFAULT 'signup',
  first_paid_at timestamptz,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(referred_user_id)
);

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner views own referrals"
  ON public.partner_referrals FOR SELECT TO authenticated
  USING (public.is_partner_owner(partner_id));

CREATE POLICY "Admins manage referrals"
  ON public.partner_referrals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_referrals_partner ON public.partner_referrals(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON public.partner_referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_store ON public.partner_referrals(store_id);

-- 7. partner_commissions
CREATE TABLE IF NOT EXISTS public.partner_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  referral_id uuid REFERENCES public.partner_referrals(id) ON DELETE SET NULL,
  store_id uuid,
  subscription_id uuid,
  payment_id uuid,
  amount_paid numeric NOT NULL,
  percentage numeric NOT NULL,
  commission_amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Partner views own commissions"
  ON public.partner_commissions FOR SELECT TO authenticated
  USING (public.is_partner_owner(partner_id));

CREATE POLICY "Admins manage commissions"
  ON public.partner_commissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_commissions_partner ON public.partner_commissions(partner_id, created_at DESC);

-- 8. partner_settings (singleton)
CREATE TABLE IF NOT EXISTS public.partner_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_percentage numeric NOT NULL DEFAULT 40,
  cookie_days integer NOT NULL DEFAULT 90,
  hold_days integer NOT NULL DEFAULT 14,
  minimum_withdrawal numeric NOT NULL DEFAULT 500,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads settings"
  ON public.partner_settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage settings"
  ON public.partner_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.partner_settings (default_percentage, cookie_days, hold_days, minimum_withdrawal)
SELECT 40, 90, 14, 500
WHERE NOT EXISTS (SELECT 1 FROM public.partner_settings);

-- 9. subscription_payments — payments table commission trigger fires on
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  subscription_id uuid,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending',
  gateway text,
  gateway_payment_id text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owner views own payments"
  ON public.subscription_payments FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

CREATE POLICY "Admins manage payments"
  ON public.subscription_payments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_subpay_store ON public.subscription_payments(store_id);

-- 10. add referred_by_partner_id to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS referred_by_partner_id uuid;
CREATE INDEX IF NOT EXISTS idx_stores_referred_by ON public.stores(referred_by_partner_id);

-- 11. Trigger: when a store is inserted, link to existing referral row
CREATE OR REPLACE FUNCTION public.link_store_to_partner_referral()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ref public.partner_referrals%ROWTYPE;
BEGIN
  SELECT * INTO _ref FROM public.partner_referrals
  WHERE referred_user_id = NEW.owner_id
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.partner_referrals
      SET store_id = NEW.id
      WHERE id = _ref.id AND store_id IS NULL;
    NEW.referred_by_partner_id := _ref.partner_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_store_to_partner ON public.stores;
CREATE TRIGGER trg_link_store_to_partner
  BEFORE INSERT ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.link_store_to_partner_referral();

-- 12. Trigger: commission when subscription_payments → paid
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
BEGIN
  IF NEW.status <> 'paid' THEN
    RETURN NEW;
  END IF;
  IF (TG_OP = 'UPDATE') AND OLD.status = 'paid' THEN
    RETURN NEW; -- already paid before
  END IF;

  -- Find referral via store
  SELECT * INTO _ref FROM public.partner_referrals
  WHERE store_id = NEW.store_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _partner FROM public.partners WHERE id = _ref.partner_id;
  IF NOT FOUND OR _partner.status <> 'active' THEN
    RETURN NEW;
  END IF;

  _pct := COALESCE(_partner.commission_percentage, 40);
  _commission := ROUND((NEW.amount * _pct / 100)::numeric, 2);

  INSERT INTO public.partner_commissions (
    partner_id, referral_id, store_id, subscription_id, payment_id,
    amount_paid, percentage, commission_amount, status
  ) VALUES (
    _partner.id, _ref.id, NEW.store_id, NEW.subscription_id, NEW.id,
    NEW.amount, _pct, _commission, 'pending'
  );

  UPDATE public.partner_referrals
    SET status = 'paid',
        locked = true,
        first_paid_at = COALESCE(first_paid_at, now())
    WHERE id = _ref.id;

  UPDATE public.partners
    SET total_earnings = total_earnings + _commission,
        updated_at = now()
    WHERE id = _partner.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_commission ON public.subscription_payments;
CREATE TRIGGER trg_create_commission
  AFTER INSERT OR UPDATE OF status ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.create_partner_commission_on_paid();

-- 13. updated_at trigger on partners
DROP TRIGGER IF EXISTS trg_partners_updated_at ON public.partners;
CREATE TRIGGER trg_partners_updated_at
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
