
-- Phase 1.5: Queue, branding fields, analytics, pilot, segments

-- 1. Platform config additions
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS wa_queue_batch_size int NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS wa_pilot_mode boolean NOT NULL DEFAULT true;

-- 2. Stores WA settings: pilot cohort flag
ALTER TABLE public.stores_wa_settings
  ADD COLUMN IF NOT EXISTS pilot_cohort boolean NOT NULL DEFAULT false;

-- 3. Template enhancements (branding/marketing fields)
ALTER TABLE public.platform_wa_templates
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'transactional',
  ADD COLUMN IF NOT EXISTS button_label text,
  ADD COLUMN IF NOT EXISTS headline text;

-- 4. Message analytics columns
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS replied_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS recovered_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone_created
  ON public.whatsapp_messages (recipient_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_template
  ON public.whatsapp_messages (template_name, created_at DESC);

-- 5. Send queue
CREATE TABLE IF NOT EXISTS public.wa_send_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  recipient_phone text NOT NULL,
  recipient_name text,
  template_name text NOT NULL,
  message_type text,
  order_id uuid,
  abandoned_cart_id uuid,
  campaign_id uuid,
  params jsonb NOT NULL DEFAULT '[]'::jsonb,
  priority int NOT NULL DEFAULT 5,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  attempts int NOT NULL DEFAULT 0,
  max_attempts int NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'pending',
  last_error text,
  last_error_class text,
  locked_until timestamptz,
  sent_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wa_send_queue TO authenticated;
GRANT ALL ON public.wa_send_queue TO service_role;
ALTER TABLE public.wa_send_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wa_queue_admin_read ON public.wa_send_queue;
CREATE POLICY wa_queue_admin_read ON public.wa_send_queue
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_wa_queue_claim
  ON public.wa_send_queue (status, scheduled_at)
  WHERE status = 'pending';

-- 6. Back in stock waitlist (placeholder; UI later)
CREATE TABLE IF NOT EXISTS public.back_in_stock_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  variant_id uuid,
  customer_phone text NOT NULL,
  customer_name text,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.back_in_stock_waitlist TO anon, authenticated;
GRANT ALL ON public.back_in_stock_waitlist TO service_role;
ALTER TABLE public.back_in_stock_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bis_insert ON public.back_in_stock_waitlist;
CREATE POLICY bis_insert ON public.back_in_stock_waitlist
  FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS bis_admin ON public.back_in_stock_waitlist;
CREATE POLICY bis_admin ON public.back_in_stock_waitlist
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Customer segments view (per storefront_customer)
CREATE OR REPLACE VIEW public.customer_segments_v1 AS
SELECT
  sc.id AS customer_id,
  sc.store_id,
  sc.phone,
  sc.name,
  COALESCE(o.total_orders, 0) AS total_orders,
  COALESCE(o.total_spent, 0) AS total_spent,
  o.last_order_at,
  EXISTS (
    SELECT 1 FROM public.abandoned_carts ac
    WHERE ac.store_id = sc.store_id
      AND ac.customer_phone = sc.phone
      AND ac.recovered = false
      AND ac.created_at > now() - interval '14 days'
  ) AS has_abandoned_cart
FROM public.storefront_customers sc
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS total_orders,
    COALESCE(SUM(total), 0) AS total_spent,
    MAX(created_at) AS last_order_at
  FROM public.orders
  WHERE storefront_customer_id = sc.id
) o ON true;

GRANT SELECT ON public.customer_segments_v1 TO service_role;

-- 8. RPC: expand campaign audience (security definer, admin only)
CREATE OR REPLACE FUNCTION public.expand_campaign_audience(
  _filter jsonb,
  _limit int DEFAULT 5000,
  _offset int DEFAULT 0
)
RETURNS TABLE (customer_id uuid, store_id uuid, phone text, name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  seg text := COALESCE(_filter->>'segment', 'all');
  store_ids uuid[];
  min_spent numeric := COALESCE((_filter->>'min_spent')::numeric, 0);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF _filter ? 'store_ids' AND jsonb_typeof(_filter->'store_ids') = 'array' THEN
    SELECT array_agg((value)::uuid) INTO store_ids FROM jsonb_array_elements_text(_filter->'store_ids');
  END IF;

  RETURN QUERY
  SELECT s.customer_id, s.store_id, s.phone, s.name
  FROM public.customer_segments_v1 s
  WHERE s.phone IS NOT NULL
    AND (store_ids IS NULL OR s.store_id = ANY(store_ids))
    AND s.total_spent >= min_spent
    AND CASE seg
      WHEN 'all' THEN true
      WHEN 'with_orders' THEN s.total_orders > 0
      WHEN 'no_orders' THEN s.total_orders = 0
      WHEN 'high_value' THEN s.total_spent >= 5000
      WHEN 'vip' THEN s.total_orders >= 3 AND s.total_spent >= 10000
      WHEN 'abandoned_cart' THEN s.has_abandoned_cart
      WHEN 'recent_30d' THEN s.last_order_at > now() - interval '30 days'
      WHEN 'inactive_90d' THEN s.last_order_at IS NULL OR s.last_order_at < now() - interval '90 days'
      ELSE true
    END
  ORDER BY s.total_spent DESC NULLS LAST
  LIMIT _limit OFFSET _offset;
END;
$$;

REVOKE ALL ON FUNCTION public.expand_campaign_audience(jsonb, int, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.expand_campaign_audience(jsonb, int, int) TO authenticated, service_role;

-- 9. RPC: KPIs
CREATE OR REPLACE FUNCTION public.get_wa_platform_kpis(_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - (_days || ' days')::interval;
  res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'sent', COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')),
    'delivered', COUNT(*) FILTER (WHERE delivered_at IS NOT NULL),
    'read', COUNT(*) FILTER (WHERE read_at IS NOT NULL),
    'replied', COUNT(*) FILTER (WHERE replied_at IS NOT NULL),
    'failed', COUNT(*) FILTER (WHERE status = 'failed'),
    'recovered_orders', COUNT(*) FILTER (WHERE recovered_order_id IS NOT NULL),
    'recovered_revenue', COALESCE(SUM(o.total) FILTER (WHERE m.recovered_order_id IS NOT NULL), 0)
  ) INTO res
  FROM public.whatsapp_messages m
  LEFT JOIN public.orders o ON o.id = m.recovered_order_id
  WHERE m.created_at >= since AND m.sent_via = 'platform';
  RETURN COALESCE(res, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_wa_platform_kpis(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_wa_platform_kpis(int) TO authenticated, service_role;

-- 10. RPC: recovery attribution (link orders to abandoned cart messages)
CREATE OR REPLACE FUNCTION public.attribute_wa_recovery()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count int;
BEGIN
  WITH candidates AS (
    SELECT m.id AS msg_id, o.id AS order_id
    FROM public.whatsapp_messages m
    JOIN public.orders o
      ON o.customer_phone = m.recipient_phone
     AND o.store_id IS NOT DISTINCT FROM m.store_id
     AND o.created_at BETWEEN m.created_at AND m.created_at + interval '48 hours'
    WHERE m.message_type = 'abandoned_cart'
      AND m.sent_via = 'platform'
      AND m.status IN ('sent','delivered','read')
      AND m.recovered_order_id IS NULL
      AND m.created_at > now() - interval '7 days'
  )
  UPDATE public.whatsapp_messages m
     SET recovered_order_id = c.order_id, updated_at = now()
    FROM candidates c
   WHERE m.id = c.msg_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.attribute_wa_recovery() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.attribute_wa_recovery() TO service_role;

-- 11. Updated_at trigger for queue
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_wa_queue_touch ON public.wa_send_queue;
CREATE TRIGGER trg_wa_queue_touch BEFORE UPDATE ON public.wa_send_queue
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
