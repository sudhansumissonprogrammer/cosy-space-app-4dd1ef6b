
-- 1) Pricing config (single row, admin editable)
CREATE TABLE IF NOT EXISTS public.wa_pricing_config (
  id boolean PRIMARY KEY DEFAULT true,
  price_marketing numeric(10,4) NOT NULL DEFAULT 1.00,
  price_utility numeric(10,4) NOT NULL DEFAULT 0.30,
  price_authentication numeric(10,4) NOT NULL DEFAULT 0.30,
  price_service numeric(10,4) NOT NULL DEFAULT 0.00,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wa_pricing_singleton CHECK (id = true)
);

GRANT SELECT ON public.wa_pricing_config TO authenticated;
GRANT ALL ON public.wa_pricing_config TO service_role;
ALTER TABLE public.wa_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_pricing_read_all_auth"
  ON public.wa_pricing_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "wa_pricing_admin_write"
  ON public.wa_pricing_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.wa_pricing_config (id) VALUES (true) ON CONFLICT DO NOTHING;

-- 2) Billing conversations
CREATE TABLE IF NOT EXISTS public.wa_billing_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  category text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  window_end timestamptz NOT NULL,
  message_count integer NOT NULL DEFAULT 1,
  first_message_id uuid,
  last_message_id uuid,
  price_charged numeric(10,4) NOT NULL DEFAULT 0,
  charged_at timestamptz,
  ledger_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness enforced by advisory lock in charge fn + this composite index for fast lookup
CREATE INDEX IF NOT EXISTS wa_bc_active_lookup_idx
  ON public.wa_billing_conversations (store_id, recipient_phone, category, window_end DESC);
CREATE INDEX IF NOT EXISTS wa_bc_store_created_idx
  ON public.wa_billing_conversations (store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_bc_ledger_idx
  ON public.wa_billing_conversations (ledger_id);

GRANT SELECT ON public.wa_billing_conversations TO authenticated;
GRANT ALL ON public.wa_billing_conversations TO service_role;
ALTER TABLE public.wa_billing_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_bc_store_owner_read"
  ON public.wa_billing_conversations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s
            WHERE s.id = wa_billing_conversations.store_id
              AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- 3) Charge function
CREATE OR REPLACE FUNCTION public.charge_wa_conversation(
  _store_id uuid,
  _recipient_phone text,
  _category text,
  _message_id uuid,
  _template_name text DEFAULT NULL,
  _delivered_at timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat text;
  v_price numeric;
  v_existing_id uuid;
  v_new_id uuid;
  v_wallet_id uuid;
  v_balance numeric;
  v_ledger_id uuid;
  v_phone text;
BEGIN
  IF _store_id IS NULL OR _recipient_phone IS NULL THEN RETURN NULL; END IF;

  v_phone := regexp_replace(_recipient_phone, '\D', '', 'g');
  IF v_phone = '' THEN RETURN NULL; END IF;

  v_cat := lower(coalesce(_category, 'marketing'));
  IF v_cat NOT IN ('marketing','utility','authentication','service') THEN
    v_cat := 'marketing';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(_store_id::text || '|' || v_phone || '|' || v_cat, 42));

  SELECT id INTO v_existing_id
    FROM public.wa_billing_conversations
   WHERE store_id = _store_id
     AND recipient_phone = v_phone
     AND category = v_cat
     AND window_end > now()
   ORDER BY window_end DESC
   LIMIT 1
   FOR UPDATE;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.wa_billing_conversations
       SET message_count = message_count + 1,
           last_message_id = _message_id,
           updated_at = now()
     WHERE id = v_existing_id;
    RETURN v_existing_id;
  END IF;

  SELECT CASE v_cat
           WHEN 'marketing' THEN price_marketing
           WHEN 'utility' THEN price_utility
           WHEN 'authentication' THEN price_authentication
           WHEN 'service' THEN price_service
         END
    INTO v_price
    FROM public.wa_pricing_config WHERE id = true;
  v_price := coalesce(v_price, 0);

  SELECT id, balance INTO v_wallet_id, v_balance
    FROM public.store_wallets WHERE store_id = _store_id FOR UPDATE;
  IF v_wallet_id IS NULL THEN
    INSERT INTO public.store_wallets (store_id, balance, total_recharged, total_charged)
    VALUES (_store_id, 0, 0, 0)
    RETURNING id, balance INTO v_wallet_id, v_balance;
  END IF;

  INSERT INTO public.wa_billing_conversations
    (store_id, recipient_phone, category, window_start, window_end,
     first_message_id, last_message_id, price_charged, message_count)
  VALUES
    (_store_id, v_phone, v_cat, _delivered_at, _delivered_at + interval '24 hours',
     _message_id, _message_id, v_price, 1)
  RETURNING id INTO v_new_id;

  IF v_price > 0 THEN
    UPDATE public.store_wallets
       SET balance = balance - v_price,
           total_charged = coalesce(total_charged, 0) + v_price,
           updated_at = now()
     WHERE id = v_wallet_id
     RETURNING balance INTO v_balance;

    INSERT INTO public.store_wallet_ledger
      (store_id, direction, amount, kind, balance_after, notes)
    VALUES
      (_store_id, 'debit', v_price, 'wa_conversation', v_balance,
       json_build_object(
         'category', v_cat,
         'recipient_phone', v_phone,
         'template_name', _template_name,
         'conversation_id', v_new_id
       )::text)
    RETURNING id INTO v_ledger_id;

    UPDATE public.wa_billing_conversations
       SET ledger_id = v_ledger_id, charged_at = now()
     WHERE id = v_new_id;
  ELSE
    UPDATE public.wa_billing_conversations SET charged_at = now() WHERE id = v_new_id;
  END IF;

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.charge_wa_conversation(uuid, text, text, uuid, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.charge_wa_conversation(uuid, text, text, uuid, text, timestamptz) TO service_role;

-- 4) Trigger
CREATE OR REPLACE FUNCTION public.wa_messages_charge_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cat text;
BEGIN
  IF NEW.direction IS DISTINCT FROM 'incoming' THEN
    IF NEW.status = 'delivered'
       AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'delivered')
       AND NEW.store_id IS NOT NULL
       AND NEW.recipient_phone IS NOT NULL THEN

      IF NEW.message_type = 'text_reply' THEN
        v_cat := 'service';
      ELSIF NEW.template_name IS NOT NULL THEN
        SELECT lower(category) INTO v_cat
          FROM public.platform_wa_templates
         WHERE name = NEW.template_name LIMIT 1;
      END IF;
      IF v_cat IS NULL THEN v_cat := 'marketing'; END IF;

      PERFORM public.charge_wa_conversation(
        NEW.store_id, NEW.recipient_phone, v_cat, NEW.id,
        NEW.template_name, coalesce(NEW.delivered_at, now())
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wa_messages_charge_on_delivered ON public.whatsapp_messages;
CREATE TRIGGER wa_messages_charge_on_delivered
  AFTER UPDATE OF status ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.wa_messages_charge_trigger();

DROP TRIGGER IF EXISTS wa_messages_charge_on_insert ON public.whatsapp_messages;
CREATE TRIGGER wa_messages_charge_on_insert
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW
  WHEN (NEW.status = 'delivered' AND NEW.direction IS DISTINCT FROM 'incoming')
  EXECUTE FUNCTION public.wa_messages_charge_trigger();

-- 5) Summary function
CREATE OR REPLACE FUNCTION public.wa_billing_summary(
  _store_id uuid,
  _since timestamptz DEFAULT (now() - interval '30 days')
) RETURNS TABLE (
  category text,
  conversations bigint,
  messages bigint,
  charged numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT category,
         count(*)::bigint,
         coalesce(sum(message_count),0)::bigint,
         coalesce(sum(price_charged),0)::numeric
    FROM public.wa_billing_conversations
   WHERE store_id = _store_id AND created_at >= _since
   GROUP BY category ORDER BY category;
$$;

GRANT EXECUTE ON FUNCTION public.wa_billing_summary(uuid, timestamptz) TO authenticated, service_role;
