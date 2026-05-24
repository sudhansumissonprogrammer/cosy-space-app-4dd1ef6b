DROP FUNCTION IF EXISTS public.get_dashboard_stats(uuid);

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total_products int;
  _total_orders int;
  _total_customers int;
  _total_views bigint;
BEGIN
  IF NOT (is_store_owner(_store_id) OR has_role(auth.uid(), 'admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COUNT(*) INTO _total_products FROM products WHERE store_id = _store_id;
  SELECT COUNT(*) INTO _total_orders FROM orders
    WHERE store_id = _store_id
      AND status IN ('confirmed','shipped','delivered','partially_paid');
  SELECT COUNT(*) INTO _total_customers FROM customers WHERE store_id = _store_id;
  SELECT COALESCE(COUNT(*), 0) INTO _total_views
    FROM page_views WHERE store_id = _store_id AND is_bot = false;

  RETURN jsonb_build_object(
    'total_products', _total_products,
    'total_orders', _total_orders,
    'total_customers', _total_customers,
    'total_views', _total_views
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;