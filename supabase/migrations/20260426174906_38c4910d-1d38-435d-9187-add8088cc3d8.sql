-- 1. Extend store_plan_assignments with billing cycle fields
ALTER TABLE public.store_plan_assignments
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone,
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS last_payment_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS next_billing_amount numeric,
  ADD COLUMN IF NOT EXISTS grace_period_ends_at timestamp with time zone;

-- Validation trigger for billing_status (instead of CHECK constraint)
CREATE OR REPLACE FUNCTION public.validate_billing_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.billing_status NOT IN ('trialing','active','past_due','suspended','cancelled','lifetime','one_time_paid') THEN
    RAISE EXCEPTION 'Invalid billing_status: %', NEW.billing_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_billing_status ON public.store_plan_assignments;
CREATE TRIGGER trg_validate_billing_status
  BEFORE INSERT OR UPDATE ON public.store_plan_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_billing_status();

-- 2. Backfill: existing stores get 7-day trial from now
UPDATE public.store_plan_assignments
SET 
  trial_ends_at = COALESCE(trial_ends_at, now() + interval '7 days'),
  billing_status = CASE
    WHEN is_free_lifetime THEN 'lifetime'
    WHEN is_one_time THEN 'one_time_paid'
    ELSE COALESCE(billing_status, 'trialing')
  END
WHERE billing_status IS NULL OR billing_status = 'trialing';

-- 3. Update auto-assign trigger so new stores get a 7-day trial
CREATE OR REPLACE FUNCTION public.auto_assign_plan_to_new_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _default_plan_id uuid;
BEGIN
  SELECT id INTO _default_plan_id FROM public.plans WHERE slug = 'free' AND is_active = true LIMIT 1;
  IF _default_plan_id IS NOT NULL THEN
    INSERT INTO public.store_plan_assignments (
      store_id, plan_id, trial_ends_at, billing_status
    )
    VALUES (
      NEW.id, _default_plan_id, now() + interval '7 days', 'trialing'
    )
    ON CONFLICT (store_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- 4. Subscription payments table
CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  plan_id uuid,
  cashfree_order_id text NOT NULL UNIQUE,
  cashfree_payment_id text UNIQUE,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending',
  payment_method text,
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  raw_payload jsonb,
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  paid_at timestamp with time zone
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_store ON public.subscription_payments(store_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON public.subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_order ON public.subscription_payments(cashfree_order_id);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

-- Validation trigger for payment status
CREATE OR REPLACE FUNCTION public.validate_subscription_payment_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending','processing','paid','failed','refunded','cancelled','expired') THEN
    RAISE EXCEPTION 'Invalid payment status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_payment_status ON public.subscription_payments;
CREATE TRIGGER trg_validate_payment_status
  BEFORE INSERT OR UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.validate_subscription_payment_status();

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_subscription_payments_updated ON public.subscription_payments;
CREATE TRIGGER trg_subscription_payments_updated
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Admins manage all
CREATE POLICY "Admins can manage subscription payments"
  ON public.subscription_payments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: Store owners can view their own payments
CREATE POLICY "Store owners can view own payments"
  ON public.subscription_payments
  FOR SELECT
  USING (is_store_owner(store_id));

-- 5. Helper function: get current billing state for a store
CREATE OR REPLACE FUNCTION public.get_store_billing_state(_store_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'plan_id', spa.plan_id,
    'plan_name', COALESCE(spa.custom_plan_name, p.name),
    'plan_slug', p.slug,
    'price', COALESCE(spa.custom_price, p.price),
    'currency', p.currency,
    'is_free_lifetime', spa.is_free_lifetime,
    'is_one_time', spa.is_one_time,
    'billing_status', spa.billing_status,
    'trial_ends_at', spa.trial_ends_at,
    'current_period_end', spa.current_period_end,
    'grace_period_ends_at', spa.grace_period_ends_at,
    'last_payment_at', spa.last_payment_at,
    'is_suspended', s.is_suspended,
    'days_until_action', CASE
      WHEN spa.is_free_lifetime OR spa.is_one_time THEN NULL
      WHEN spa.billing_status = 'trialing' THEN GREATEST(0, EXTRACT(DAY FROM spa.trial_ends_at - now())::int)
      WHEN spa.billing_status = 'active' THEN GREATEST(0, EXTRACT(DAY FROM spa.current_period_end - now())::int)
      WHEN spa.billing_status = 'past_due' THEN GREATEST(0, EXTRACT(DAY FROM spa.grace_period_ends_at - now())::int)
      ELSE 0
    END,
    'requires_payment', (
      NOT spa.is_free_lifetime
      AND NOT spa.is_one_time
      AND COALESCE(spa.custom_price, p.price) > 0
      AND spa.billing_status IN ('trialing','past_due','suspended')
    )
  ) INTO result
  FROM public.store_plan_assignments spa
  JOIN public.plans p ON p.id = spa.plan_id
  JOIN public.stores s ON s.id = spa.store_id
  WHERE spa.store_id = _store_id
  LIMIT 1;

  RETURN result;
END;
$$;