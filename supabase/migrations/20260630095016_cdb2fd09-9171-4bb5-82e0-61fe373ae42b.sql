
-- 1. Remove broken trigger that enqueued the wrong template (order_shipped_v1)
--    with an incomplete variable set. Shipping is now enqueued by the
--    wa-order-event edge function, called from the storefront admin when a
--    merchant marks an order as shipped (with tracking number).
DROP TRIGGER IF EXISTS trg_wa_order_status ON public.orders;
DROP FUNCTION IF EXISTS public.wa_enqueue_order_event() CASCADE;

-- 2. Sensible default per-phone marketing cap.
UPDATE public.platform_config SET wa_daily_cap_per_phone = 3 WHERE wa_daily_cap_per_phone < 3;
