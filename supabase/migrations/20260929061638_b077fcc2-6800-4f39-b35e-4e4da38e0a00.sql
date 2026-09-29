CREATE OR REPLACE FUNCTION public.reserve_payu_attempt(_order_id uuid, _store_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_base text;
  v_txnid text;
BEGIN
  SELECT * INTO v_order FROM public.orders
    WHERE id = _order_id AND store_id = _store_id
    FOR UPDATE;
  IF NOT FOUND OR v_order.payment_method IS DISTINCT FROM 'payu' THEN
    RAISE EXCEPTION 'PayU order not found';
  END IF;
  IF v_order.status <> 'pending' OR v_order.payment_verified IS TRUE THEN
    RAISE EXCEPTION 'Order is not awaiting payment';
  END IF;
  v_base := 'sb_' || left(replace(v_order.id::text, '-', ''), 16);
  IF coalesce(array_length(v_order.payu_txnids, 1), 0) = 0 THEN
    v_txnid := v_base;
  ELSE
    LOOP
      v_txnid := v_base || 'x' || left(replace(gen_random_uuid()::text, '-', ''), 5);
      EXIT WHEN NOT (v_txnid = ANY(v_order.payu_txnids));
    END LOOP;
  END IF;
  UPDATE public.orders SET payu_txnids = array_append(coalesce(v_order.payu_txnids, ARRAY[]::text[]), v_txnid)
    WHERE id = _order_id;
  RETURN v_txnid;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_payu_attempt(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payu_attempt(uuid, uuid) TO service_role;