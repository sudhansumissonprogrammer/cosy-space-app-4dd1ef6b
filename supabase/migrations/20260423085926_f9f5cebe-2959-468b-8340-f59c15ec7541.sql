-- 1. Update handle_new_user trigger to skip storefront customers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _user_type text;
BEGIN
  _user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'merchant');

  -- Only create merchant profile + subscription for merchants
  IF _user_type = 'merchant' THEN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
    ON CONFLICT DO NOTHING;

    INSERT INTO public.subscriptions (user_id, plan_id)
    SELECT NEW.id, id FROM public.plans WHERE slug = 'free' LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- 2. Update admin RPC to only return merchants (people with a store OR explicitly tagged as merchant)
CREATE OR REPLACE FUNCTION public.get_admin_users_stores()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    WHERE
      -- Has a store (definitely a merchant)
      s.id IS NOT NULL
      -- OR explicitly tagged as merchant in metadata
      OR COALESCE(u.raw_user_meta_data->>'user_type', 'merchant') = 'merchant'
         AND NOT EXISTS (
           SELECT 1 FROM public.storefront_customers sc WHERE sc.user_id = u.id
         )
  ) t;

  RETURN result;
END;
$function$;

-- 3. Backfill: cleanup stray merchant data for existing storefront shoppers
-- A user is a "shopper-only" if they have a storefront_customers row AND no store
DELETE FROM public.subscriptions
WHERE user_id IN (
  SELECT sc.user_id
  FROM public.storefront_customers sc
  WHERE NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = sc.user_id)
);

DELETE FROM public.profiles
WHERE user_id IN (
  SELECT sc.user_id
  FROM public.storefront_customers sc
  WHERE NOT EXISTS (SELECT 1 FROM public.stores s WHERE s.owner_id = sc.user_id)
);