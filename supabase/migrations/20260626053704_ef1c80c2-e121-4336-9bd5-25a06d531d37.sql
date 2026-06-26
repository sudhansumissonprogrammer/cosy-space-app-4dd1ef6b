
-- 1. Atomic category reorder
CREATE OR REPLACE FUNCTION public.swap_category_order(_a uuid, _b uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store_id_a uuid;
  _store_id_b uuid;
  _order_a int;
  _order_b int;
BEGIN
  SELECT store_id, display_order INTO _store_id_a, _order_a FROM public.categories WHERE id = _a;
  SELECT store_id, display_order INTO _store_id_b, _order_b FROM public.categories WHERE id = _b;
  IF _store_id_a IS NULL OR _store_id_b IS NULL OR _store_id_a <> _store_id_b THEN
    RAISE EXCEPTION 'invalid category swap';
  END IF;
  -- Auth: caller must own the store
  IF NOT EXISTS (SELECT 1 FROM public.stores WHERE id = _store_id_a AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  UPDATE public.categories SET display_order = _order_b WHERE id = _a;
  UPDATE public.categories SET display_order = _order_a WHERE id = _b;
END;
$$;
GRANT EXECUTE ON FUNCTION public.swap_category_order(uuid, uuid) TO authenticated;

-- 2. Track abandoned-cart recovery sends (resumability)
ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS recovery_sent_at timestamptz;

-- 3. Recovery coupon helper — picks the store's highest-discount active coupon
CREATE OR REPLACE FUNCTION public.get_store_recovery_coupon(_store_id uuid)
RETURNS TABLE(code text, discount_type text, discount_value numeric, min_order_amount numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.code, c.discount_type, c.discount_value, c.min_order_amount
  FROM public.coupons c
  WHERE c.store_id = _store_id
    AND c.is_active = true
    AND (c.starts_at IS NULL OR c.starts_at <= now())
    AND (c.expires_at IS NULL OR c.expires_at > now())
    AND (c.max_uses IS NULL OR c.used_count < c.max_uses)
  ORDER BY c.discount_value DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_store_recovery_coupon(uuid) TO authenticated, anon;
