CREATE OR REPLACE FUNCTION public.enforce_spin_wheel_requirements()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.app_id = 'spin-wheel' THEN
    NEW.enabled := true;
    NEW.config := jsonb_set(COALESCE(NEW.config, '{}'::jsonb), '{require_otp}', 'true'::jsonb, true);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_spin_wheel_requirements ON public.store_apps;
CREATE TRIGGER trg_enforce_spin_wheel_requirements
BEFORE INSERT OR UPDATE ON public.store_apps
FOR EACH ROW
EXECUTE FUNCTION public.enforce_spin_wheel_requirements();

UPDATE public.store_apps
SET enabled = true,
    config = jsonb_set(COALESCE(config, '{}'::jsonb), '{require_otp}', 'true'::jsonb, true)
WHERE app_id = 'spin-wheel';