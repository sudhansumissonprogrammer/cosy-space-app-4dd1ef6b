-- 1. WhatsApp queue: dedupe lookup by phone (166k calls/day, full scans today)
CREATE INDEX IF NOT EXISTS idx_wa_queue_phone_created
  ON public.wa_send_queue (recipient_phone, created_at DESC);

-- 2. WhatsApp queue: worker claim ordering (status='pending' ORDER BY priority, scheduled_at)
CREATE INDEX IF NOT EXISTS idx_wa_queue_claim_priority
  ON public.wa_send_queue (priority, scheduled_at)
  WHERE status = 'pending';

-- 3. page_views: per-store non-bot aggregates used by dashboards/admin
CREATE INDEX IF NOT EXISTS idx_page_views_store_bot_created
  ON public.page_views (store_id, is_bot, created_at DESC);

-- 4. Drop duplicate / never-used indexes (write amplification on hot tables)
DROP INDEX IF EXISTS public.idx_whatsapp_messages_phone_created;  -- exact dupe of idx_wa_messages_phone_created
DROP INDEX IF EXISTS public.abandoned_carts_recovery_idx;         -- superseded by idx_abandoned_carts_recovery_window
DROP INDEX IF EXISTS public.idx_orders_payu_txnids;               -- GIN on write-hot orders, 0 scans
DROP INDEX IF EXISTS public.idx_products_category_pinned;         -- 0 scans
DROP INDEX IF EXISTS public.idx_products_has_variants;            -- 0 scans
DROP INDEX IF EXISTS public.idx_upsell_events_store_created;      -- 0 scans

-- 5. Rate-limit table is ephemeral counters: skip WAL for it
ALTER TABLE public.edge_rate_limits SET UNLOGGED;

-- 6. Top products aggregated server-side (replaces full order_items pagination scan)
CREATE OR REPLACE FUNCTION public.get_top_products(_store_id uuid, _limit int DEFAULT 5)
RETURNS TABLE(name text, qty bigint, revenue numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT oi.product_name AS name,
         SUM(COALESCE(oi.quantity, 0))::bigint AS qty,
         COALESCE(SUM(oi.total), 0)::numeric AS revenue
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.store_id = _store_id
    AND o.status <> 'cancelled'
    AND oi.product_name IS NOT NULL
    AND (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role))
  GROUP BY oi.product_name
  ORDER BY qty DESC
  LIMIT GREATEST(COALESCE(_limit, 5), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products(uuid, int) TO authenticated;
