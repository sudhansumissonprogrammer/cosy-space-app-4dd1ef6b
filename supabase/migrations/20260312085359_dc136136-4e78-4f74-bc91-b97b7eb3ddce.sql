
-- 1. Attach the missing trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Create get_admin_users_stores RPC
CREATE OR REPLACE FUNCTION public.get_admin_users_stores()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.user_created_at DESC), '[]'::json)
  INTO result
  FROM (
    SELECT
      u.id as user_id,
      u.email,
      u.created_at as user_created_at,
      p.full_name,
      COALESCE(p.is_blocked, false) as is_blocked,
      s.id as store_id,
      s.name as store_name,
      s.slug as store_slug,
      s.logo_url as store_logo,
      COALESCE(s.is_suspended, false) as is_suspended,
      COALESCE(s.is_verified, false) as is_verified,
      s.created_at as store_created_at,
      COALESCE(pc.product_count, 0) as product_count,
      COALESCE(oc.order_count, 0) as order_count
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.user_id = u.id
    LEFT JOIN public.stores s ON s.owner_id = u.id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as product_count
      FROM public.products pr WHERE pr.store_id = s.id
    ) pc ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int as order_count
      FROM public.whatsapp_orders wo WHERE wo.store_id = s.id
    ) oc ON true
  ) t;

  RETURN result;
END;
$$;

-- 3. Enhanced get_admin_stats with recent activity
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS json
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
    'total_users', (SELECT COUNT(*) FROM auth.users),
    'total_stores', (SELECT COUNT(*) FROM public.stores),
    'total_products', (SELECT COUNT(*) FROM public.products),
    'total_orders', (SELECT COUNT(*) FROM public.whatsapp_orders),
    'total_revenue', COALESCE((SELECT SUM(product_price * quantity) FROM public.whatsapp_orders WHERE status != 'cancelled'), 0),
    'suspended_stores', (SELECT COUNT(*) FROM public.stores WHERE is_suspended = true),
    'blocked_users', (SELECT COUNT(*) FROM public.profiles WHERE is_blocked = true),
    'recent_signups', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT u.email, u.created_at
        FROM auth.users u
        ORDER BY u.created_at DESC
        LIMIT 5
      ) t
    ),
    'recent_orders', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT wo.product_name, wo.product_price, wo.quantity, wo.created_at, s.name as store_name
        FROM public.whatsapp_orders wo
        JOIN public.stores s ON s.id = wo.store_id
        ORDER BY wo.created_at DESC
        LIMIT 5
      ) t
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 4. Create platform_config table
CREATE TABLE IF NOT EXISTS public.platform_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_name text NOT NULL DEFAULT 'Storiva',
  default_currency text NOT NULL DEFAULT 'INR',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage platform config"
  ON public.platform_config FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can view platform config"
  ON public.platform_config FOR SELECT
  TO public
  USING (true);
