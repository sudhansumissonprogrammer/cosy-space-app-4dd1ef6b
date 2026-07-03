
-- Per-event WhatsApp automation toggles, all OFF by default
ALTER TABLE public.stores_wa_settings
  ALTER COLUMN platform_marketing_enabled SET DEFAULT false,
  ADD COLUMN IF NOT EXISTS send_order_confirmation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS send_order_shipped boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS send_abandoned_cart boolean NOT NULL DEFAULT false;

-- Turn every existing store OFF (master + per-event) so nothing sends until merchant opts in
UPDATE public.stores_wa_settings
   SET platform_marketing_enabled = false,
       send_order_confirmation = false,
       send_order_shipped = false,
       send_abandoned_cart = false;

-- Read all toggles at once
CREATE OR REPLACE FUNCTION public.get_store_wa_toggles(_store_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'master', COALESCE(s.platform_marketing_enabled, false),
    'order_confirmation', COALESCE(s.send_order_confirmation, false),
    'order_shipped', COALESCE(s.send_order_shipped, false),
    'abandoned_cart', COALESCE(s.send_abandoned_cart, false)
  )
  FROM public.stores st
  LEFT JOIN public.stores_wa_settings s ON s.store_id = st.id
  WHERE st.id = _store_id
    AND (st.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  LIMIT 1;
$$;

-- Set an individual toggle key
CREATE OR REPLACE FUNCTION public.set_store_wa_toggle(_store_id uuid, _key text, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ok boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.stores
    WHERE id = _store_id
      AND (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  INSERT INTO public.stores_wa_settings (store_id) VALUES (_store_id)
  ON CONFLICT (store_id) DO NOTHING;

  IF _key = 'master' THEN
    UPDATE public.stores_wa_settings SET platform_marketing_enabled = _enabled WHERE store_id = _store_id;
  ELSIF _key = 'order_confirmation' THEN
    UPDATE public.stores_wa_settings SET send_order_confirmation = _enabled WHERE store_id = _store_id;
  ELSIF _key = 'order_shipped' THEN
    UPDATE public.stores_wa_settings SET send_order_shipped = _enabled WHERE store_id = _store_id;
  ELSIF _key = 'abandoned_cart' THEN
    UPDATE public.stores_wa_settings SET send_abandoned_cart = _enabled WHERE store_id = _store_id;
  ELSE
    RAISE EXCEPTION 'unknown toggle key: %', _key;
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_wa_toggles(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_store_wa_toggle(uuid, text, boolean) TO authenticated;
