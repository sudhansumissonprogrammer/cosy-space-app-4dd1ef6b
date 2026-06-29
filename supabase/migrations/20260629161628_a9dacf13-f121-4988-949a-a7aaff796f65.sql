-- Dedup guard for WhatsApp order events.
-- Ensures order_confirmation and order_shipped are enqueued AT MOST ONCE per order.
-- Covers: double-clicks, retries, status flips (shipped → other → shipped), parallel webhooks.

-- 1) Order-shipped trigger: skip if we already have a queued/sent shipped row.
CREATE OR REPLACE FUNCTION public.wa_enqueue_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean;
  v_phone text;
  v_store_settings record;
  v_store record;
  v_base text;
  v_order_link text;
  v_tracking_url text;
  v_tracking_no text;
  v_order_num text;
  v_total text;
  v_exists boolean;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT wa_enabled INTO v_enabled FROM public.platform_config LIMIT 1;
  IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

  -- Only shipped is auto-enqueued from status changes. Confirmation is
  -- handled by notify-order. Delivered / cancelled / review are disabled.
  IF NEW.status <> 'shipped' THEN RETURN NEW; END IF;

  IF NEW.tracking_number IS NULL OR length(trim(NEW.tracking_number)) = 0 THEN
    RETURN NEW;
  END IF;

  -- 🔒 Idempotency: if we've already queued or sent a shipped message for this order, skip.
  SELECT EXISTS(
    SELECT 1 FROM public.wa_send_queue
    WHERE order_id = NEW.id
      AND message_type = 'order_shipped'
      AND status IN ('pending','sending','sent','skipped')
  ) INTO v_exists;
  IF v_exists THEN RETURN NEW; END IF;

  v_phone := regexp_replace(coalesce(NEW.customer_phone,''), '[^0-9]', '', 'g');
  IF length(v_phone) < 8 THEN RETURN NEW; END IF;

  SELECT * INTO v_store_settings FROM public.stores_wa_settings WHERE store_id = NEW.store_id;
  IF v_store_settings.platform_marketing_enabled IS FALSE THEN RETURN NEW; END IF;

  SELECT name, slug, custom_domain INTO v_store FROM public.stores WHERE id = NEW.store_id;
  v_base := CASE WHEN v_store.custom_domain IS NOT NULL THEN 'https://' || v_store.custom_domain
                 WHEN v_store.slug IS NOT NULL THEN 'https://' || v_store.slug || '.shopbanao.in'
                 ELSE 'https://shopbanao.in' END;
  v_order_link := v_base || '/account/orders/' || NEW.id::text;
  v_tracking_url := coalesce(NEW.tracking_url, v_order_link);
  v_tracking_no := coalesce(NEW.tracking_number, '');
  v_order_num := coalesce(NEW.order_number, upper(substring(NEW.id::text, 1, 8)));
  v_total := '₹' || to_char(coalesce(NEW.total,0), 'FM999999990');

  INSERT INTO public.wa_send_queue (
    store_id, recipient_phone, recipient_name, template_name, message_type,
    order_id, params, template_vars, priority, scheduled_at
  ) VALUES (
    NEW.store_id, v_phone, coalesce(NEW.customer_name,'there'),
    'order_shipped_v1', 'order_shipped',
    NEW.id, '[]'::jsonb,
    jsonb_build_object(
      'customer_name', coalesce(NEW.customer_name,'there'),
      'order_number', v_order_num,
      'order_total', v_total,
      'order_link', v_order_link,
      'tracking_url', v_tracking_url,
      'tracking_number', v_tracking_no
    ),
    2, now()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $function$;

-- 2) Partial unique index: at most one active (non-failed) row per (order_id, message_type).
-- Hard guarantee at DB level, even if app code races. Allows reinsert only after a 'failed' row.
CREATE UNIQUE INDEX IF NOT EXISTS wa_send_queue_order_event_uniq
ON public.wa_send_queue (order_id, message_type)
WHERE order_id IS NOT NULL
  AND message_type IN ('order_confirmation','order_shipped')
  AND status IN ('pending','sending','sent','skipped');