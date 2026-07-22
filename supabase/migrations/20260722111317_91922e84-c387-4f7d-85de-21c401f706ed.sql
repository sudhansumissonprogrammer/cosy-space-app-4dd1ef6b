ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS auto_apply boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS coupons_one_auto_apply_per_store
  ON public.coupons(store_id)
  WHERE auto_apply = true AND is_active = true;

CREATE OR REPLACE FUNCTION public.get_store_auto_apply_coupon(_store_id uuid)
RETURNS TABLE (
  id uuid,
  code text,
  discount_type text,
  discount_value numeric,
  min_order_amount numeric,
  max_uses integer,
  used_count integer,
  starts_at timestamptz,
  expires_at timestamptz,
  auto_apply boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.code, c.discount_type, c.discount_value, c.min_order_amount,
         c.max_uses, c.used_count, c.starts_at, c.expires_at, c.auto_apply
  FROM public.coupons c
  WHERE c.store_id = _store_id
    AND c.auto_apply = true
    AND c.is_active = true
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_auto_apply_coupon(uuid) TO anon, authenticated;