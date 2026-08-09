CREATE OR REPLACE FUNCTION public.capture_checkout_lead(p_store_id uuid, p_phone text, p_cart_items jsonb DEFAULT '[]'::jsonb, p_consent boolean DEFAULT true, p_session_token text DEFAULT NULL::text, p_source text DEFAULT 'checkout_step1'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_phone text := public.canonical_in_phone(p_phone);
  v_cart_id uuid;
  v_lead_id uuid;
  v_store_ok boolean;
  v_first jsonb;
  v_product_id uuid;
  v_product_name text;
  v_extra int;
BEGIN
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_phone');
  END IF;
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_store');
  END IF;

  SELECT (COALESCE(is_suspended, false) = false) INTO v_store_ok
  FROM public.stores WHERE id = p_store_id;
  IF NOT COALESCE(v_store_ok, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'store_not_found');
  END IF;

  IF p_cart_items IS NOT NULL AND jsonb_typeof(p_cart_items) = 'array'
     AND jsonb_array_length(p_cart_items) > 0 THEN
    v_first := p_cart_items->0;
    BEGIN
      v_product_id := NULLIF(v_first->>'productId', '')::uuid;
    EXCEPTION WHEN others THEN
      v_product_id := NULL;
    END;
    v_product_name := NULLIF(v_first->>'name', '');
    v_extra := jsonb_array_length(p_cart_items) - 1;
    IF v_product_name IS NOT NULL AND v_extra > 0 THEN
      v_product_name := v_product_name || ' +' || v_extra;
    END IF;
    IF v_product_id IS NOT NULL THEN
      PERFORM 1 FROM public.products
        WHERE id = v_product_id AND store_id = p_store_id;
      IF NOT FOUND THEN
        v_product_id := NULL;
      END IF;
    END IF;
  END IF;

  -- Dedupe by store+phone ONLY (source is intentionally ignored).
  -- Quick Buy, checkout step 1 and checkout v2 all describe the SAME shopper
  -- journey; matching on source used to create 2-3 rows per shopper.
  SELECT id INTO v_lead_id
  FROM public.customer_leads
  WHERE store_id = p_store_id
    AND phone    = v_phone
    AND created_at > now() - interval '12 hours'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_lead_id IS NULL THEN
    INSERT INTO public.customer_leads (store_id, phone, source, product_id, product_name)
    VALUES (p_store_id, v_phone, p_source, v_product_id, v_product_name)
    RETURNING id INTO v_lead_id;
  ELSE
    UPDATE public.customer_leads
       SET created_at   = now(),
           source       = COALESCE(p_source, source),
           product_id   = COALESCE(v_product_id, product_id),
           product_name = COALESCE(v_product_name, product_name)
     WHERE id = v_lead_id;
  END IF;

  SELECT id INTO v_cart_id
  FROM public.abandoned_carts
  WHERE store_id = p_store_id
    AND customer_phone = v_phone
    AND (
      (p_session_token IS NOT NULL AND session_token = p_session_token)
      OR (p_session_token IS NULL AND created_at > now() - interval '24 hours')
    )
    AND recovered = false
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_cart_id IS NULL THEN
    INSERT INTO public.abandoned_carts (
      store_id, customer_phone, cart_items, session_token,
      wa_marketing_consent, recovered
    ) VALUES (
      p_store_id, v_phone, COALESCE(p_cart_items, '[]'::jsonb), p_session_token,
      COALESCE(p_consent, true), false
    )
    RETURNING id INTO v_cart_id;
  ELSE
    UPDATE public.abandoned_carts
       SET cart_items           = COALESCE(p_cart_items, cart_items),
           wa_marketing_consent = COALESCE(p_consent, wa_marketing_consent),
           recovery_sent_at     = NULL,
           recovery_status      = NULL,
           recovery_error       = NULL
     WHERE id = v_cart_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'phone', v_phone,
    'cart_id', v_cart_id,
    'lead_id', v_lead_id
  );
END;
$function$;