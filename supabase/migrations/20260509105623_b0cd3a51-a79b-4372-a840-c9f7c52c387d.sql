
-- 1. Prevent duplicate commissions for the same payment
CREATE UNIQUE INDEX IF NOT EXISTS partner_commissions_payment_id_unique
  ON public.partner_commissions(payment_id)
  WHERE payment_id IS NOT NULL;

-- 2. Lock partner self-edits to safe columns only
DROP POLICY IF EXISTS "Partners can update own row" ON public.partners;

CREATE POLICY "Partners update own basic fields"
  ON public.partners FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.guard_partner_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins bypass all guards
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Non-admin self-update: force-protect sensitive fields
  IF auth.uid() = OLD.user_id THEN
    NEW.user_id              := OLD.user_id;
    NEW.partner_code         := OLD.partner_code;
    NEW.commission_percentage:= OLD.commission_percentage;
    NEW.status               := OLD.status;
    NEW.total_earnings       := OLD.total_earnings;
    NEW.created_at           := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_partner_self_update ON public.partners;
CREATE TRIGGER trg_guard_partner_self_update
  BEFORE UPDATE ON public.partners
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_partner_self_update();

-- 3. Truncate long click metadata to keep the table safe from abuse
CREATE OR REPLACE FUNCTION public.truncate_referral_click_inputs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.referrer IS NOT NULL THEN
    NEW.referrer := LEFT(NEW.referrer, 1000);
  END IF;
  IF NEW.landing_path IS NOT NULL THEN
    NEW.landing_path := LEFT(NEW.landing_path, 1000);
  END IF;
  IF NEW.user_agent IS NOT NULL THEN
    NEW.user_agent := LEFT(NEW.user_agent, 1000);
  END IF;
  IF NEW.ip IS NOT NULL THEN
    NEW.ip := LEFT(NEW.ip, 100);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_truncate_referral_click_inputs ON public.partner_referral_clicks;
CREATE TRIGGER trg_truncate_referral_click_inputs
  BEFORE INSERT OR UPDATE ON public.partner_referral_clicks
  FOR EACH ROW
  EXECUTE FUNCTION public.truncate_referral_click_inputs();
