
-- Lock down anon cross-store enumeration on coupons & store_pages by routing
-- storefront reads through SECURITY DEFINER RPCs that always require store_id.

-- ============================================================
-- COUPONS
-- ============================================================

-- Best active coupon (for ExitIntent / PDP teaser)
CREATE OR REPLACE FUNCTION public.get_store_coupon_teaser(_store_id uuid)
RETURNS TABLE (
  code text,
  discount_type text,
  discount_value numeric,
  min_order_amount numeric,
  expires_at timestamptz,
  starts_at timestamptz,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.code, c.discount_type, c.discount_value, c.min_order_amount,
         c.expires_at, c.starts_at, c.is_active
  FROM public.coupons c
  WHERE c.store_id = _store_id
    AND c.is_active = true
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
  ORDER BY c.discount_value DESC
  LIMIT 1
$$;

-- Boolean: does store have any active coupons?
CREATE OR REPLACE FUNCTION public.store_has_active_coupons(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coupons
    WHERE store_id = _store_id AND is_active = true
  )
$$;

-- Validate a coupon by code (returns row or empty). Storefront uses this at checkout.
CREATE OR REPLACE FUNCTION public.validate_store_coupon(_store_id uuid, _code text)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  min_order_amount numeric,
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer,
  used_count integer,
  is_active boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.code, c.discount_type, c.discount_value, c.min_order_amount,
         c.starts_at, c.expires_at, c.max_uses, c.used_count, c.is_active
  FROM public.coupons c
  WHERE c.store_id = _store_id
    AND c.is_active = true
    AND upper(c.code) = upper(_code)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_store_coupon_teaser(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_has_active_coupons(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_store_coupon(uuid, text) TO anon, authenticated;

-- Remove anon cross-store enumeration policy
DROP POLICY IF EXISTS "Public can view active coupons" ON public.coupons;
REVOKE SELECT ON public.coupons FROM anon;

-- ============================================================
-- STORE PAGES
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_store_custom_pages(_store_id uuid)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  content text,
  image_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.id, sp.title, sp.slug, sp.content, sp.image_url
  FROM public.store_pages sp
  WHERE sp.store_id = _store_id
    AND sp.page_type = 'custom'
    AND sp.is_active = true
  ORDER BY sp.display_order ASC NULLS LAST
$$;

CREATE OR REPLACE FUNCTION public.get_store_custom_page(_store_slug text, _page_slug text)
RETURNS TABLE (
  id uuid,
  title text,
  slug text,
  content text,
  image_url text,
  store_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.id, sp.title, sp.slug, sp.content, sp.image_url, sp.store_id
  FROM public.store_pages sp
  JOIN public.stores s ON s.id = sp.store_id
  WHERE s.slug = _store_slug
    AND sp.slug = _page_slug
    AND sp.page_type = 'custom'
    AND sp.is_active = true
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_store_custom_pages(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_custom_page(text, text) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view active pages" ON public.store_pages;
REVOKE SELECT ON public.store_pages FROM anon;
