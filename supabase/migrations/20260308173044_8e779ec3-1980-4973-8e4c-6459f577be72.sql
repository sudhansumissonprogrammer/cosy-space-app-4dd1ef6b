
-- Add is_blocked to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;

-- Allow admins to update any profile (for blocking)
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to delete stores
CREATE POLICY "Admins can delete any store" ON public.stores
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to manage subscriptions (insert/update/delete)
CREATE POLICY "Admins can insert subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update subscriptions" ON public.subscriptions
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete subscriptions" ON public.subscriptions
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert own subscription (for auto-assign on signup via trigger)
CREATE POLICY "Users can insert own subscription" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Update get_admin_stats to include products, revenue
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    'total_products', (SELECT COUNT(*) FROM public.products),
    'total_orders', (SELECT COUNT(*) FROM public.whatsapp_orders),
    'total_revenue', COALESCE((SELECT SUM(product_price * quantity) FROM public.whatsapp_orders WHERE status != 'cancelled'), 0),
    'suspended_stores', (SELECT COUNT(*) FROM public.stores WHERE is_suspended = true),
    'blocked_users', (SELECT COUNT(*) FROM public.profiles WHERE is_blocked = true)
  ) INTO result;

  RETURN result;
END;
$$;

-- Admin analytics function
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_build_object(
    'stores_by_month', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*) as count
        FROM public.stores
        GROUP BY to_char(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      ) t
    ),
    'revenue_by_month', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT to_char(created_at, 'YYYY-MM') as month, 
               SUM(product_price * quantity) as revenue,
               COUNT(*) as orders
        FROM public.whatsapp_orders
        WHERE status != 'cancelled'
        GROUP BY to_char(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      ) t
    ),
    'users_by_month', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT to_char(created_at, 'YYYY-MM') as month, COUNT(*) as count
        FROM public.profiles
        GROUP BY to_char(created_at, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;
