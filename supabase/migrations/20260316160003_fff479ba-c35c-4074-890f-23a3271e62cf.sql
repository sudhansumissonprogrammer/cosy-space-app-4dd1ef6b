
-- Store-level plan assignments with override capabilities
CREATE TABLE public.store_plan_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  -- Override fields
  custom_price numeric DEFAULT NULL,
  is_free_lifetime boolean NOT NULL DEFAULT false,
  is_one_time boolean NOT NULL DEFAULT false,
  custom_product_limit integer DEFAULT NULL,
  notes text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

-- RLS
ALTER TABLE public.store_plan_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage store plan assignments"
  ON public.store_plan_assignments FOR ALL
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Store owners can view own plan assignment"
  ON public.store_plan_assignments FOR SELECT
  TO authenticated
  USING (is_store_owner(store_id));

-- Updated_at trigger
CREATE TRIGGER update_store_plan_assignments_updated_at
  BEFORE UPDATE ON public.store_plan_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-assign default (free) plan to new stores
CREATE OR REPLACE FUNCTION public.auto_assign_plan_to_new_store()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _default_plan_id uuid;
BEGIN
  SELECT id INTO _default_plan_id FROM public.plans WHERE slug = 'free' AND is_active = true LIMIT 1;
  IF _default_plan_id IS NOT NULL THEN
    INSERT INTO public.store_plan_assignments (store_id, plan_id)
    VALUES (NEW.id, _default_plan_id)
    ON CONFLICT (store_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_plan_new_store
  AFTER INSERT ON public.stores
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_plan_to_new_store();

-- Auto-assign new plans to all existing stores (only for free plans)
CREATE OR REPLACE FUNCTION public.auto_assign_new_plan_to_stores()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  -- When a new plan is created, assign it to stores that don't have any assignment yet
  INSERT INTO public.store_plan_assignments (store_id, plan_id)
  SELECT s.id, NEW.id
  FROM public.stores s
  WHERE NOT EXISTS (
    SELECT 1 FROM public.store_plan_assignments spa WHERE spa.store_id = s.id
  )
  ON CONFLICT (store_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_new_plan
  AFTER INSERT ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_new_plan_to_stores();

-- Seed: assign free plan to all existing stores that don't have an assignment
INSERT INTO public.store_plan_assignments (store_id, plan_id)
SELECT s.id, p.id
FROM public.stores s
CROSS JOIN (SELECT id FROM public.plans WHERE slug = 'free' AND is_active = true LIMIT 1) p
WHERE NOT EXISTS (
  SELECT 1 FROM public.store_plan_assignments spa WHERE spa.store_id = s.id
);
