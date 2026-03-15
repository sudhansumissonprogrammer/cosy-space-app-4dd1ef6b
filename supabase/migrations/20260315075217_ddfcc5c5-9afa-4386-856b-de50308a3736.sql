
-- 1. WhatsApp opt-outs table
CREATE TABLE public.whatsapp_optouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  phone text NOT NULL,
  opted_out_at timestamptz NOT NULL DEFAULT now(),
  reason text DEFAULT 'customer_request',
  UNIQUE(store_id, phone)
);

ALTER TABLE public.whatsapp_optouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage optouts"
  ON public.whatsapp_optouts FOR ALL
  TO authenticated
  USING (is_store_owner(store_id))
  WITH CHECK (is_store_owner(store_id));

CREATE POLICY "Edge functions can insert optouts"
  ON public.whatsapp_optouts FOR INSERT
  TO public
  WITH CHECK (true);

-- 2. Scheduled messages table
CREATE TABLE public.whatsapp_scheduled (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  message_body text NOT NULL,
  recipient_phones jsonb NOT NULL DEFAULT '[]',
  segment_filter jsonb DEFAULT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  sent_count integer DEFAULT 0,
  failed_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_scheduled ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage scheduled messages"
  ON public.whatsapp_scheduled FOR ALL
  TO authenticated
  USING (is_store_owner(store_id))
  WITH CHECK (is_store_owner(store_id));
