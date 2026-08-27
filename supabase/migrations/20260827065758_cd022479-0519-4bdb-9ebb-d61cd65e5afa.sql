
ALTER TABLE public.stores_wa_settings
  ADD COLUMN IF NOT EXISTS send_cod_confirmation boolean NOT NULL DEFAULT false;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cod_confirm_status text,
  ADD COLUMN IF NOT EXISTS cod_confirm_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS cod_confirm_followup_at timestamptz,
  ADD COLUMN IF NOT EXISTS cod_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cod_confirm_reply text;

DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_cod_confirm_status_chk
    CHECK (cod_confirm_status IS NULL OR cod_confirm_status IN ('awaiting','confirmed','edit_requested','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS orders_cod_confirm_awaiting_idx
  ON public.orders (cod_confirm_sent_at)
  WHERE cod_confirm_status = 'awaiting';

CREATE OR REPLACE FUNCTION public.get_store_wa_toggles(_store_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'master', COALESCE(s.platform_marketing_enabled, false),
    'order_confirmation', COALESCE(s.send_order_confirmation, false),
    'order_shipped', COALESCE(s.send_order_shipped, false),
    'abandoned_cart', COALESCE(s.send_abandoned_cart, false),
    'cod_confirmation', COALESCE(s.send_cod_confirmation, false)
  )
  FROM public.stores st
  LEFT JOIN public.stores_wa_settings s ON s.store_id = st.id
  WHERE st.id = _store_id
    AND (st.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.set_store_wa_toggle(_store_id uuid, _key text, _enabled boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  ELSIF _key = 'cod_confirmation' THEN
    UPDATE public.stores_wa_settings SET send_cod_confirmation = _enabled WHERE store_id = _store_id;
  ELSE
    RAISE EXCEPTION 'unknown toggle key: %', _key;
  END IF;

  RETURN true;
END;
$function$;

INSERT INTO public.platform_wa_templates
  (name, purpose, language, category, header_type, body_text, footer_text, buttons, variables, is_active, body_preview, headline)
VALUES
  (
    'cod_order_confirm_v1', 'utility', 'en', 'UTILITY', 'IMAGE',
    E'Hey {{1}}, thank you for choosing {{2}}! ✨\n\nWe have received your Cash on Delivery order:\n\n• Item: {{3}}\n• Order: {{4}}\n• Amount Payable: {{5}} (COD)\n• Delivery Address: {{6}}\n\nPlease confirm your order below so our team can dispatch it immediately.',
    'Tap a button below — it takes one second.',
    '[{"type":"QUICK_REPLY","text":"✅ Confirm Order"},{"type":"QUICK_REPLY","text":"✏️ Edit Address"}]'::jsonb,
    ARRAY['customer_name','store_name','product_name','order_number','order_total','delivery_address'],
    true,
    'Hey Rahul, thank you for choosing Utkal Watches! We have received your Cash on Delivery order…',
    'COD order confirmation'
  ),
  (
    'cod_confirm_followup_v1', 'utility', 'en', 'UTILITY', 'TEXT',
    E'Hey {{1}}, we are holding your order {{2}} ({{3}}, Cash on Delivery) for dispatch.\n\nShould we ship it today? Tap below so we can pack it right away.',
    'Reply anytime — we are here to help.',
    '[{"type":"QUICK_REPLY","text":"✅ Confirm Order"},{"type":"QUICK_REPLY","text":"✏️ Edit Address"}]'::jsonb,
    ARRAY['customer_name','order_number','order_total'],
    true,
    'Hey Rahul, we are holding your order SDJ-1042 (₹1,599, Cash on Delivery) for dispatch…',
    'COD confirmation follow-up'
  )
ON CONFLICT (name) DO NOTHING;
