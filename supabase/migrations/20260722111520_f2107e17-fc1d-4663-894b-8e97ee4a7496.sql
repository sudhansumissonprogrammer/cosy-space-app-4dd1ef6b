DROP FUNCTION IF EXISTS public.validate_store_coupon(uuid, text);

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
  is_active boolean,
  auto_apply boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.code, c.discount_type, c.discount_value, c.min_order_amount,
         c.starts_at, c.expires_at, c.max_uses, c.used_count, c.is_active, c.auto_apply
  FROM public.coupons c
  WHERE c.store_id = _store_id
    AND c.is_active = true
    AND upper(c.code) = upper(_code)
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.validate_store_coupon(uuid, text) TO anon, authenticated;