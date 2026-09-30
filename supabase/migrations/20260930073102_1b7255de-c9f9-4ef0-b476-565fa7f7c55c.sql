ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cashfree_order_ids text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.append_cashfree_order_id(_order_id uuid, _cf_order_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.orders
     SET cashfree_order_ids = array_append(cashfree_order_ids, _cf_order_id)
   WHERE id = _order_id AND NOT (_cf_order_id = ANY(cashfree_order_ids));
$$;
REVOKE ALL ON FUNCTION public.append_cashfree_order_id(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_cashfree_order_id(uuid, text) TO service_role;