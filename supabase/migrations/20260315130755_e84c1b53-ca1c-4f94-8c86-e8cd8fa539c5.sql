
CREATE TABLE public.whatsapp_bulk_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  admin_campaign boolean DEFAULT false,
  message_body text,
  template_name text,
  template_params jsonb,
  recipient_count int DEFAULT 0,
  sent_count int DEFAULT 0,
  failed_count int DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.whatsapp_bulk_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage own campaigns"
  ON public.whatsapp_bulk_campaigns FOR ALL TO authenticated
  USING (is_store_owner(store_id))
  WITH CHECK (is_store_owner(store_id));

CREATE POLICY "Admins can manage all campaigns"
  ON public.whatsapp_bulk_campaigns FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
