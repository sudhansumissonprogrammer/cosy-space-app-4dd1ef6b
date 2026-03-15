
-- Table to store store owner's WhatsApp Business API credentials
CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  phone_number_id text NOT NULL,
  waba_id text,
  business_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

-- Table to store message templates
CREATE TABLE public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_type text NOT NULL DEFAULT 'order_confirmation',
  language_code text NOT NULL DEFAULT 'en',
  body_text text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table to log all sent messages with delivery status and analytics
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  message_type text NOT NULL DEFAULT 'order_confirmation',
  recipient_phone text NOT NULL,
  recipient_name text,
  message_body text NOT NULL,
  meta_message_id text,
  status text NOT NULL DEFAULT 'queued',
  error_message text,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  abandoned_cart_id uuid REFERENCES public.abandoned_carts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_config (store owners only - sensitive credentials)
CREATE POLICY "Store owners can manage whatsapp config"
  ON public.whatsapp_config FOR ALL TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked())
  WITH CHECK (is_store_owner(store_id) AND NOT is_user_blocked());

-- RLS policies for whatsapp_templates
CREATE POLICY "Store owners can manage whatsapp templates"
  ON public.whatsapp_templates FOR ALL TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked())
  WITH CHECK (is_store_owner(store_id) AND NOT is_user_blocked());

-- RLS policies for whatsapp_messages
CREATE POLICY "Store owners can manage whatsapp messages"
  ON public.whatsapp_messages FOR ALL TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked())
  WITH CHECK (is_store_owner(store_id) AND NOT is_user_blocked());

-- Admins can view all
CREATE POLICY "Admins can manage whatsapp config"
  ON public.whatsapp_config FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage whatsapp templates"
  ON public.whatsapp_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage whatsapp messages"
  ON public.whatsapp_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime for messages (for live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
