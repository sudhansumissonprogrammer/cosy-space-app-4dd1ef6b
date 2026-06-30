
-- 1. Backfill: everyone is commission
UPDATE public.stores SET billing_mode = 'commission' WHERE billing_mode IS DISTINCT FROM 'commission';

-- 2. Ensure commission config for every store at 3%
INSERT INTO public.store_commission_config (store_id, commission_percentage, min_recharge, low_balance_threshold, is_active)
SELECT s.id, 3.00, 500, 100, true
FROM public.stores s
LEFT JOIN public.store_commission_config c ON c.store_id = s.id
WHERE c.id IS NULL;

-- 3. Lock billing_mode default + constraint to commission only
ALTER TABLE public.stores ALTER COLUMN billing_mode SET DEFAULT 'commission';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stores_billing_mode_check') THEN
    ALTER TABLE public.stores DROP CONSTRAINT stores_billing_mode_check;
  END IF;
END $$;
ALTER TABLE public.stores ADD CONSTRAINT stores_billing_mode_check CHECK (billing_mode = 'commission');

-- 4. Drop subscription-era triggers
DROP TRIGGER IF EXISTS trg_auto_assign_new_plan ON public.plans;
DROP TRIGGER IF EXISTS trg_auto_assign_plan_new_store ON public.stores;
DROP TRIGGER IF EXISTS trg_subscription_payments_updated ON public.subscription_payments;
DROP TRIGGER IF EXISTS trg_subscription_payment_refund ON public.subscription_payments;
DROP TRIGGER IF EXISTS update_store_plan_assignments_updated_at ON public.store_plan_assignments;

-- 5. Drop subscription-era functions
DROP FUNCTION IF EXISTS public.get_store_billing_state(uuid);
DROP FUNCTION IF EXISTS public.validate_billing_status() CASCADE;
DROP FUNCTION IF EXISTS public.validate_subscription_payment_status() CASCADE;
DROP FUNCTION IF EXISTS public.tg_subscription_payment_refund() CASCADE;
DROP FUNCTION IF EXISTS public.auto_assign_new_plan_to_stores() CASCADE;
DROP FUNCTION IF EXISTS public.auto_assign_plan_to_new_store() CASCADE;
DROP FUNCTION IF EXISTS public.admin_set_billing_mode(uuid, text) CASCADE;

-- 6. Drop legacy tables (subscription system)
DROP TABLE IF EXISTS public.subscription_payments CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.store_plan_assignments CASCADE;
DROP TABLE IF EXISTS public.plans CASCADE;

-- 7. Keep is_store_commission_mode for back-compat — always true now
CREATE OR REPLACE FUNCTION public.is_store_commission_mode(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT true;
$function$;

-- 8. New stores auto-get a 3% commission config row
CREATE OR REPLACE FUNCTION public.tg_auto_commission_for_new_store()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.store_commission_config (store_id, commission_percentage, min_recharge, low_balance_threshold, is_active)
  VALUES (NEW.id, 3.00, 500, 100, true)
  ON CONFLICT (store_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_commission_new_store ON public.stores;
CREATE TRIGGER trg_auto_commission_new_store
AFTER INSERT ON public.stores
FOR EACH ROW EXECUTE FUNCTION public.tg_auto_commission_for_new_store();

-- 9. Unschedule legacy billing cron (ignore errors)
DO $$ BEGIN
  PERFORM cron.unschedule('billing-cron');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
