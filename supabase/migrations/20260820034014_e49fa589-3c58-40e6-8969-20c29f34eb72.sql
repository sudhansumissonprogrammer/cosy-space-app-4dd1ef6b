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
  _pending_orders int;
  _abandoned_carts int;
  _store record;
  _has_payments boolean;
  _has_shipping boolean;
  _has_theme boolean;
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

  SELECT COUNT(*) INTO _pending_orders FROM orders
    WHERE store_id = _store_id AND status = 'pending';
  SELECT COUNT(*) INTO _abandoned_carts FROM abandoned_carts
    WHERE store_id = _store_id AND recovered = false;

  SELECT logo_url, banner_url, whatsapp_number, description, order_mode, owner_name
    INTO _store
    FROM stores WHERE id = _store_id;

  SELECT EXISTS (SELECT 1 FROM store_payment_config WHERE store_id = _store_id) INTO _has_payments;
  SELECT EXISTS (SELECT 1 FROM store_shipping_config WHERE store_id = _store_id) INTO _has_shipping;
  SELECT EXISTS (SELECT 1 FROM store_theme_config WHERE store_id = _store_id) INTO _has_theme;

  RETURN jsonb_build_object(
    'total_products', _total_products,
    'total_orders', _total_orders,
    'total_customers', _total_customers,
    'total_views', _total_views,
    'pending_orders', _pending_orders,
    'abandoned_carts', _abandoned_carts,
    'setup', jsonb_build_object(
      'logo_url', _store.logo_url,
      'banner_url', _store.banner_url,
      'whatsapp_number', _store.whatsapp_number,
      'description', _store.description,
      'order_mode', _store.order_mode,
      'owner_name', _store.owner_name,
      'has_payments', COALESCE(_has_payments, false),
      'has_shipping', COALESCE(_has_shipping, false),
      'has_theme', COALESCE(_has_theme, false)
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) TO authenticated;