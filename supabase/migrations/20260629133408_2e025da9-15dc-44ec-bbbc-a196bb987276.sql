
-- 1. Extend platform_config
ALTER TABLE public.platform_config
  ADD COLUMN IF NOT EXISTS whatsapp_mode text NOT NULL DEFAULT 'platform_only',
  ADD COLUMN IF NOT EXISTS wa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS wa_default_lang text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS wa_min_cart_age_minutes int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS wa_max_cart_age_hours int NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS wa_daily_cap_per_phone int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS wa_app_secret text,
  ADD COLUMN IF NOT EXISTS wa_waba_id text;

-- Validate mode via trigger (not CHECK, per project rules)
CREATE OR REPLACE FUNCTION public._validate_platform_config()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.whatsapp_mode NOT IN ('platform_only','dual_mode','merchant_only') THEN
    RAISE EXCEPTION 'invalid whatsapp_mode: %', NEW.whatsapp_mode;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS platform_config_validate ON public.platform_config;
CREATE TRIGGER platform_config_validate
  BEFORE INSERT OR UPDATE ON public.platform_config
  FOR EACH ROW EXECUTE FUNCTION public._validate_platform_config();

-- Ensure at least one row exists
INSERT INTO public.platform_config (id, platform_name)
SELECT gen_random_uuid(), 'ShopBanao'
WHERE NOT EXISTS (SELECT 1 FROM public.platform_config);

-- 2. stores_wa_settings (single toggle per store)
CREATE TABLE IF NOT EXISTS public.stores_wa_settings (
  store_id uuid PRIMARY KEY REFERENCES public.stores(id) ON DELETE CASCADE,
  platform_marketing_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stores_wa_settings TO authenticated;
GRANT ALL ON public.stores_wa_settings TO service_role;
ALTER TABLE public.stores_wa_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "store owners read own wa settings"
  ON public.stores_wa_settings FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "store owners upsert own wa settings"
  ON public.stores_wa_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

CREATE POLICY "store owners update own wa settings"
  ON public.stores_wa_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  );

-- 3. platform_wa_templates
CREATE TABLE IF NOT EXISTS public.platform_wa_templates (
  name text PRIMARY KEY,
  purpose text NOT NULL,
  language text NOT NULL DEFAULT 'en',
  body_preview text,
  variables text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_wa_templates TO authenticated;
GRANT ALL ON public.platform_wa_templates TO service_role;
ALTER TABLE public.platform_wa_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage platform templates"
  ON public.platform_wa_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE POLICY "authenticated read active platform templates"
  ON public.platform_wa_templates FOR SELECT TO authenticated
  USING (is_active = true);

-- 4. platform_wa_campaigns
CREATE TABLE IF NOT EXISTS public.platform_wa_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_name text NOT NULL REFERENCES public.platform_wa_templates(name),
  audience_filter jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  scheduled_at timestamptz,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_wa_campaigns TO authenticated;
GRANT ALL ON public.platform_wa_campaigns TO service_role;
ALTER TABLE public.platform_wa_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage platform campaigns"
  ON public.platform_wa_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 5. Extend whatsapp_messages
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS sent_via text NOT NULL DEFAULT 'merchant',
  ADD COLUMN IF NOT EXISTS template_name text;

ALTER TABLE public.whatsapp_messages ALTER COLUMN store_id DROP NOT NULL;

-- 6. Allow null store on whatsapp_optouts (global opt-outs)
ALTER TABLE public.whatsapp_optouts ALTER COLUMN store_id DROP NOT NULL;

-- 7. Extend abandoned_carts with recovery status fields
ALTER TABLE public.abandoned_carts
  ADD COLUMN IF NOT EXISTS recovery_status text,
  ADD COLUMN IF NOT EXISTS recovery_message_id text,
  ADD COLUMN IF NOT EXISTS recovery_error text;

-- 8. Idempotency index for cart recovery: at most one platform recovery per cart
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_one_cart_recovery
  ON public.whatsapp_messages (abandoned_cart_id)
  WHERE abandoned_cart_id IS NOT NULL AND message_type = 'abandoned_cart' AND sent_via = 'platform';

-- 9. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_wa_messages_phone_created
  ON public.whatsapp_messages (recipient_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_recovery_window
  ON public.abandoned_carts (created_at)
  WHERE recovered = false AND recovery_sent_at IS NULL;

-- 10. Public RPC: get current WhatsApp mode
CREATE OR REPLACE FUNCTION public.get_whatsapp_mode()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT whatsapp_mode FROM public.platform_config LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_mode() TO anon, authenticated;

-- 11. Admin RPC: get platform WA config (token masked)
CREATE OR REPLACE FUNCTION public.admin_get_platform_wa_config()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO r FROM public.platform_config LIMIT 1;
  RETURN jsonb_build_object(
    'whatsapp_mode', r.whatsapp_mode,
    'wa_enabled', r.wa_enabled,
    'wa_phone_number_id', r.wa_phone_number_id,
    'wa_business_phone', r.wa_business_phone,
    'wa_waba_id', r.wa_waba_id,
    'wa_default_lang', r.wa_default_lang,
    'wa_min_cart_age_minutes', r.wa_min_cart_age_minutes,
    'wa_max_cart_age_hours', r.wa_max_cart_age_hours,
    'wa_daily_cap_per_phone', r.wa_daily_cap_per_phone,
    'wa_access_token_present', (r.wa_access_token IS NOT NULL AND length(r.wa_access_token) > 0),
    'wa_app_secret_present', (r.wa_app_secret IS NOT NULL AND length(r.wa_app_secret) > 0)
  );
END $$;
GRANT EXECUTE ON FUNCTION public.admin_get_platform_wa_config() TO authenticated;

-- 12. Admin RPC: update platform WA config
CREATE OR REPLACE FUNCTION public.admin_update_platform_wa_config(_patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  SELECT id INTO pid FROM public.platform_config LIMIT 1;

  UPDATE public.platform_config SET
    whatsapp_mode = COALESCE(_patch->>'whatsapp_mode', whatsapp_mode),
    wa_enabled = COALESCE((_patch->>'wa_enabled')::boolean, wa_enabled),
    wa_phone_number_id = COALESCE(NULLIF(_patch->>'wa_phone_number_id',''), wa_phone_number_id),
    wa_business_phone = COALESCE(NULLIF(_patch->>'wa_business_phone',''), wa_business_phone),
    wa_waba_id = COALESCE(NULLIF(_patch->>'wa_waba_id',''), wa_waba_id),
    wa_access_token = COALESCE(NULLIF(_patch->>'wa_access_token',''), wa_access_token),
    wa_app_secret = COALESCE(NULLIF(_patch->>'wa_app_secret',''), wa_app_secret),
    wa_default_lang = COALESCE(NULLIF(_patch->>'wa_default_lang',''), wa_default_lang),
    wa_min_cart_age_minutes = COALESCE((_patch->>'wa_min_cart_age_minutes')::int, wa_min_cart_age_minutes),
    wa_max_cart_age_hours = COALESCE((_patch->>'wa_max_cart_age_hours')::int, wa_max_cart_age_hours),
    wa_daily_cap_per_phone = COALESCE((_patch->>'wa_daily_cap_per_phone')::int, wa_daily_cap_per_phone),
    updated_at = now()
  WHERE id = pid;

  RETURN public.admin_get_platform_wa_config();
END $$;
GRANT EXECUTE ON FUNCTION public.admin_update_platform_wa_config(jsonb) TO authenticated;

-- 13. Owner/admin: read per-store toggle (auto-creates default row)
CREATE OR REPLACE FUNCTION public.get_store_platform_marketing(_store_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v boolean;
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT platform_marketing_enabled INTO v FROM public.stores_wa_settings WHERE store_id = _store_id;
  IF v IS NULL THEN
    RETURN true; -- default ON
  END IF;
  RETURN v;
END $$;
GRANT EXECUTE ON FUNCTION public.get_store_platform_marketing(uuid) TO authenticated;

-- 14. Owner/admin: write per-store toggle (upsert)
CREATE OR REPLACE FUNCTION public.set_store_platform_marketing(_store_id uuid, _enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = _store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(),'admin')
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.stores_wa_settings (store_id, platform_marketing_enabled)
  VALUES (_store_id, _enabled)
  ON CONFLICT (store_id) DO UPDATE
    SET platform_marketing_enabled = EXCLUDED.platform_marketing_enabled,
        updated_at = now();

  RETURN _enabled;
END $$;
GRANT EXECUTE ON FUNCTION public.set_store_platform_marketing(uuid, boolean) TO authenticated;

-- 15. updated_at trigger reuse (create if missing)
CREATE OR REPLACE FUNCTION public._touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS stores_wa_settings_touch ON public.stores_wa_settings;
CREATE TRIGGER stores_wa_settings_touch BEFORE UPDATE ON public.stores_wa_settings
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

DROP TRIGGER IF EXISTS platform_wa_templates_touch ON public.platform_wa_templates;
CREATE TRIGGER platform_wa_templates_touch BEFORE UPDATE ON public.platform_wa_templates
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

DROP TRIGGER IF EXISTS platform_wa_campaigns_touch ON public.platform_wa_campaigns;
CREATE TRIGGER platform_wa_campaigns_touch BEFORE UPDATE ON public.platform_wa_campaigns
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- 16. Seed template placeholders (inactive) so admin sees the list
INSERT INTO public.platform_wa_templates (name, purpose, language, body_preview, variables, is_active) VALUES
  ('abandoned_cart_v1','abandoned_cart','en','Hi {{1}}, you left items at {{2}}. Total {{3}}. Complete here: {{4}}',  ARRAY['customer_name','store_name','cart_total','checkout_url'], false),
  ('order_confirmation_v1','order_confirmation','en','Hi {{1}}, {{2}} received your order #{{3}} for {{4}}.', ARRAY['customer_name','store_name','order_number','order_total'], false),
  ('payment_received_v1','payment_received','en','Hi {{1}}, payment of {{2}} for order #{{3}} received at {{4}}.', ARRAY['customer_name','order_total','order_number','store_name'], false),
  ('order_shipped_v1','order_shipped','en','Hi {{1}}, your order #{{2}} from {{3}} has shipped. Track: {{4}}', ARRAY['customer_name','order_number','store_name','tracking_url'], false),
  ('order_delivered_v1','order_delivered','en','Hi {{1}}, your order #{{2}} from {{3}} has been delivered. Enjoy!', ARRAY['customer_name','order_number','store_name'], false),
  ('review_request_v1','review_request','en','Hi {{1}}, hope you loved your order from {{2}}! Leave a review: {{3}}', ARRAY['customer_name','store_name','review_url'], false)
ON CONFLICT (name) DO NOTHING;
