-- Hard gate: triggers must check platform_config.wa_enabled before enqueueing.
-- Without credentials, queue stays empty and no background work occurs.

CREATE OR REPLACE FUNCTION public.wa_enqueue_order_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean;
  v_event text;
  v_template text;
  v_phone text;
  v_store_settings record;
  v_store record;
  v_base text;
  v_order_link text;
  v_tracking_url text;
  v_order_num text;
  v_total text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;

  SELECT wa_enabled INTO v_enabled FROM public.platform_config LIMIT 1;
  IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

  IF NEW.status = 'shipped' THEN v_event := 'order_shipped'; v_template := 'order_shipped_v1';
  ELSIF NEW.status = 'delivered' THEN v_event := 'order_delivered'; v_template := 'order_delivered_v1';
  ELSIF NEW.status = 'cancelled' THEN v_event := 'order_cancelled'; v_template := 'order_cancelled_v1';
  ELSE RETURN NEW;
  END IF;

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
  v_order_num := coalesce(NEW.order_number, upper(substring(NEW.id::text, 1, 8)));
  v_total := '₹' || to_char(coalesce(NEW.total,0), 'FM999999990');

  INSERT INTO public.wa_send_queue (
    store_id, recipient_phone, recipient_name, template_name, message_type,
    order_id, params, template_vars, priority, scheduled_at
  ) VALUES (
    NEW.store_id, v_phone, coalesce(NEW.customer_name,'there'), v_template, v_event,
    NEW.id, '[]'::jsonb,
    jsonb_build_object(
      'customer_name', coalesce(NEW.customer_name,'there'),
      'order_number', v_order_num,
      'order_total', v_total,
      'order_link', v_order_link,
      'tracking_url', v_tracking_url
    ),
    2, now()
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.wa_enqueue_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_enabled boolean;
  v_phone text;
  v_store record;
  v_base text;
BEGIN
  SELECT wa_enabled INTO v_enabled FROM public.platform_config LIMIT 1;
  IF v_enabled IS NOT TRUE THEN RETURN NEW; END IF;

  v_phone := regexp_replace(coalesce(NEW.phone,''), '[^0-9]', '', 'g');
  IF length(v_phone) < 8 THEN RETURN NEW; END IF;

  SELECT name, slug, custom_domain INTO v_store FROM public.stores WHERE id = NEW.store_id;
  v_base := CASE WHEN v_store.custom_domain IS NOT NULL THEN 'https://' || v_store.custom_domain
                 WHEN v_store.slug IS NOT NULL THEN 'https://' || v_store.slug || '.shopbanao.in'
                 ELSE 'https://shopbanao.in' END;

  INSERT INTO public.wa_send_queue (
    store_id, recipient_phone, recipient_name, template_name, message_type,
    params, template_vars, priority, scheduled_at
  ) VALUES (
    NEW.store_id, v_phone, coalesce(NEW.name,'there'), 'welcome_v1', 'welcome',
    '[]'::jsonb,
    jsonb_build_object(
      'customer_name', coalesce(NEW.name,'there'),
      'store_name', coalesce(v_store.name,'our store'),
      'shop_url', v_base
    ),
    4, now() + interval '2 minutes'
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW;
END $function$;

-- Ensure master switch is OFF until admin enters Meta credentials in the dashboard.
UPDATE public.platform_config SET wa_enabled = false WHERE wa_phone_number_id IS NULL OR wa_access_token IS NULL OR wa_waba_id IS NULL;