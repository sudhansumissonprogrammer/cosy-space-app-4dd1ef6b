
-- Plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  product_limit integer, -- NULL means unlimited
  price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans
CREATE POLICY "Anyone can view active plans" ON public.plans
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage plans" ON public.plans
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Seed default plans
INSERT INTO public.plans (name, slug, product_limit, price) VALUES
  ('Free', 'free', 10, 0),
  ('Basic', 'basic', 100, 9.99),
  ('Pro', 'pro', NULL, 29.99);

-- Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage subscriptions" ON public.subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign free plan on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  -- Auto-assign free plan
  INSERT INTO public.subscriptions (user_id, plan_id)
  SELECT NEW.id, id FROM public.plans WHERE slug = 'free' LIMIT 1;
  
  RETURN NEW;
END;
$$;

-- Function to check product limit
CREATE OR REPLACE FUNCTION public.check_product_limit(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _plan_name text;
  _product_limit integer;
  _current_count integer;
BEGIN
  SELECT p.name, p.product_limit INTO _plan_name, _product_limit
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.user_id = _user_id AND s.status = 'active'
  LIMIT 1;

  IF _plan_name IS NULL THEN
    _plan_name := 'Free';
    _product_limit := 10;
  END IF;

  SELECT COUNT(*) INTO _current_count
  FROM public.products prod
  JOIN public.stores st ON st.id = prod.store_id
  WHERE st.owner_id = _user_id;

  RETURN json_build_object(
    'plan_name', _plan_name,
    'product_limit', _product_limit,
    'current_count', _current_count,
    'can_create', (_product_limit IS NULL OR _current_count < _product_limit)
  );
END;
$$;
