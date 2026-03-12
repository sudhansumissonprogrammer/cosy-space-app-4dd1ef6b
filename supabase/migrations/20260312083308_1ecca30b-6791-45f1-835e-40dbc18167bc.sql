
-- =============================================
-- FIX 1: Remove public "Anyone can view orders by id" policy (exposes PII)
-- Replace with storefront customer + store owner only
-- =============================================
DROP POLICY IF EXISTS "Anyone can view orders by id" ON public.orders;

-- =============================================
-- FIX 2: Remove public "Anyone can view order items" policy
-- Replace with store owner + storefront customer access
-- =============================================
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;

CREATE POLICY "Storefront customers can view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.storefront_customer_id IS NOT NULL
      AND public.is_storefront_customer(o.storefront_customer_id)
  )
);

-- =============================================
-- FIX 3: Remove user self-insert on subscriptions (privilege escalation)
-- =============================================
DROP POLICY IF EXISTS "Users can insert own subscription" ON public.subscriptions;

-- =============================================
-- FIX 4: Recreate store_payment_config_public view with security_invoker
-- =============================================
DROP VIEW IF EXISTS public.store_payment_config_public;

CREATE VIEW public.store_payment_config_public
WITH (security_invoker = on) AS
SELECT id, store_id, payment_methods, razorpay_key_id, created_at, updated_at
FROM public.store_payment_config;

-- Add a public SELECT policy on the base table for the view to work
-- (view uses security_invoker so it runs as the calling user)
CREATE POLICY "Public can view payment config via view"
ON public.store_payment_config
FOR SELECT
TO anon
USING (true);

-- =============================================
-- FIX 5: Tighten abandoned_carts - restrict anon insert/update to store_id check
-- =============================================
DROP POLICY IF EXISTS "Anyone can insert abandoned carts" ON public.abandoned_carts;
DROP POLICY IF EXISTS "Anyone can update abandoned carts" ON public.abandoned_carts;

CREATE POLICY "Anyone can insert abandoned carts"
ON public.abandoned_carts
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = abandoned_carts.store_id AND stores.is_suspended = false
  )
);

CREATE POLICY "Anyone can update abandoned carts by id"
ON public.abandoned_carts
FOR UPDATE
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.stores
    WHERE stores.id = abandoned_carts.store_id AND stores.is_suspended = false
  )
);

-- =============================================
-- FIX 6: Tighten orders INSERT to validate store is not suspended (already exists but reconfirm)
-- =============================================

-- =============================================
-- FIX 7: Hide owner_email from public/anon store queries
-- Create a function to null out owner_email for non-owners
-- =============================================
-- We'll handle this by updating the get_storefront_data function to exclude owner_email
CREATE OR REPLACE FUNCTION public.get_storefront_data(_slug text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store stores%ROWTYPE;
  _products json;
  _categories json;
  _theme_config json;
  _store_json json;
BEGIN
  SELECT * INTO _store FROM stores WHERE slug = _slug LIMIT 1;
  IF _store.id IS NULL THEN
    RETURN json_build_object('store', null, 'products', '[]'::json, 'categories', '[]'::json, 'theme_config', null);
  END IF;

  SELECT COALESCE(json_agg(p ORDER BY p.created_at DESC), '[]'::json)
  INTO _products
  FROM products p
  WHERE p.store_id = _store.id AND p.is_active = true;

  SELECT COALESCE(json_agg(c ORDER BY c.name), '[]'::json)
  INTO _categories
  FROM categories c
  WHERE c.store_id = _store.id;

  SELECT row_to_json(tc) INTO _theme_config
  FROM store_theme_config tc
  WHERE tc.store_id = _store.id;

  -- Build store JSON without owner_email and owner_id
  SELECT json_build_object(
    'id', _store.id,
    'name', _store.name,
    'slug', _store.slug,
    'description', _store.description,
    'logo_url', _store.logo_url,
    'banner_url', _store.banner_url,
    'mobile_hero_url', _store.mobile_hero_url,
    'currency', _store.currency,
    'whatsapp_number', _store.whatsapp_number,
    'instagram_url', _store.instagram_url,
    'facebook_url', _store.facebook_url,
    'order_mode', _store.order_mode,
    'theme', _store.theme,
    'features', _store.features,
    'best_selling_carousel', _store.best_selling_carousel,
    'meta_title', _store.meta_title,
    'meta_description', _store.meta_description,
    'og_image_url', _store.og_image_url,
    'facebook_pixel_id', _store.facebook_pixel_id,
    'location', _store.location,
    'city', _store.city,
    'state', _store.state,
    'business_hours', _store.business_hours,
    'custom_domain', _store.custom_domain,
    'return_policy', _store.return_policy,
    'shipping_policy', _store.shipping_policy,
    'is_suspended', _store.is_suspended,
    'is_verified', _store.is_verified,
    'created_at', _store.created_at,
    'updated_at', _store.updated_at
  ) INTO _store_json;

  RETURN json_build_object(
    'store', _store_json,
    'products', _products,
    'categories', _categories,
    'theme_config', _theme_config
  );
END;
$function$;
