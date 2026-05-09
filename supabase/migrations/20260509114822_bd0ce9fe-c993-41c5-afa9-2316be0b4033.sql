
-- 1. Replace trigger function to drop dependency on resolver + overrides
CREATE OR REPLACE FUNCTION public.create_partner_commission_on_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- 2. Drop resolver + tables we no longer need
DROP FUNCTION IF EXISTS public.resolve_partner_commission_pct(uuid, uuid);
DROP TABLE IF EXISTS public.partner_commission_overrides CASCADE;
DROP TABLE IF EXISTS public.partner_clawbacks CASCADE;
DROP TABLE IF EXISTS public.partner_rate_limits CASCADE;

-- 3. Disable realtime on noisy partner tables (keep partner_notifications)
ALTER PUBLICATION supabase_realtime DROP TABLE public.partner_referral_clicks;
ALTER PUBLICATION supabase_realtime DROP TABLE public.partner_referrals;
ALTER PUBLICATION supabase_realtime DROP TABLE public.partner_commissions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.partner_wallet_ledger;
