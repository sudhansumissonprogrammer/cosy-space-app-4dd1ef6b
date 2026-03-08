
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check role (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Only admins can view user_roles
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Add is_suspended to stores
ALTER TABLE public.stores ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT false;

-- Admin read access: admins can view all stores (including suspended)
CREATE POLICY "Admins can view all stores" ON public.stores
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin update access for stores (suspend/unsuspend)
CREATE POLICY "Admins can update any store" ON public.stores
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin read access: admins can view all profiles
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin read access: admins can view all whatsapp orders
CREATE POLICY "Admins can view all whatsapp orders" ON public.whatsapp_orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin read access: admins can view all customers
CREATE POLICY "Admins can view all customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admin read access: admins can view all products
CREATE POLICY "Admins can view all products" ON public.products
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Function to get admin dashboard stats (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_stores', (SELECT COUNT(*) FROM public.stores),
    'total_orders', (SELECT COUNT(*) FROM public.whatsapp_orders),
    'suspended_stores', (SELECT COUNT(*) FROM public.stores WHERE is_suspended = true)
  ) INTO result;

  RETURN result;
END;
$$;

-- Update public storefront policy to exclude suspended stores
DROP POLICY IF EXISTS "Public can view stores" ON public.stores;
CREATE POLICY "Public can view active stores" ON public.stores
  FOR SELECT TO anon
  USING (is_suspended = false);
