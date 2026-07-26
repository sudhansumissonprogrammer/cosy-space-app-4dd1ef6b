-- Signatures unchanged, so CREATE OR REPLACE is safe (no overload created).

-- 1) Commission-only billing: there are no product limits any more.
CREATE OR REPLACE FUNCTION public.check_product_limit(_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _current_count integer;
BEGIN
  SELECT COUNT(*) INTO _current_count
  FROM public.products prod
  JOIN public.stores st ON st.id = prod.store_id
  WHERE st.owner_id = _user_id;

  RETURN json_build_object(
    'plan_name', 'Commission',
    'product_limit', NULL,
    'current_count', _current_count,
    'can_create', true
  );
END;
$function$;

-- 2) Drop the store_plan_assignments billing_status gate (table no longer exists).
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
$function$;