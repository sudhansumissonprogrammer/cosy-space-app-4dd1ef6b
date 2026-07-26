CREATE OR REPLACE FUNCTION public.get_order_tracking(_query text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q text := btrim(coalesce(_query, ''));
  o public.orders%ROWTYPE;
  digits text;
  full_access boolean := false;
  items jsonb;
BEGIN
  IF q = '' THEN RETURN jsonb_build_object('found', false); END IF;

  IF q ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO o FROM public.orders WHERE id = q::uuid LIMIT 1;
    full_access := true;
  ELSIF q ~ '^\+?[0-9]{7,15}$' THEN
    digits := right(regexp_replace(q, '[^0-9]', '', 'g'), 10);
    SELECT * INTO o FROM public.orders
      WHERE right(regexp_replace(coalesce(customer_phone, ''), '[^0-9]', '', 'g'), 10) = digits
      ORDER BY created_at DESC LIMIT 1;
    full_access := true;
  ELSE
    SELECT * INTO o FROM public.orders WHERE order_number::text = q
      ORDER BY created_at DESC LIMIT 1;
    full_access := false;
  END IF;

  IF o.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'product_name', oi.product_name,
           'quantity', oi.quantity,
           'unit_price', oi.unit_price,
           'total', oi.total)), '[]'::jsonb)
    INTO items FROM public.order_items oi WHERE oi.order_id = o.id;

  RETURN jsonb_build_object(
    'found', true,
    'order', jsonb_build_object(
      'id', o.id,
      'order_number', o.order_number,
      'status', o.status,
      'total', o.total,
      'currency', o.currency,
      'created_at', o.created_at,
      'updated_at', o.updated_at,
      'tracking_number', o.tracking_number,
      'tracking_url', o.tracking_url,
      'payment_method', o.payment_method,
      'customer_name', CASE WHEN full_access THEN o.customer_name ELSE NULL END,
      'customer_phone', CASE WHEN full_access THEN o.customer_phone ELSE NULL END,
      'street_address', CASE WHEN full_access THEN o.street_address ELSE NULL END,
      'city', CASE WHEN full_access THEN o.city ELSE NULL END,
      'state', CASE WHEN full_access THEN o.state ELSE NULL END,
      'pincode', CASE WHEN full_access THEN o.pincode ELSE NULL END
    ),
    'items', items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_order_tracking(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_order_tracking(text) TO anon, authenticated, service_role;