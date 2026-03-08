
CREATE TABLE public.customer_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text,
  phone text NOT NULL,
  product_name text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'whatsapp_order',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_leads ENABLE ROW LEVEL SECURITY;

-- Store owners can view their leads
CREATE POLICY "Store owners can view leads"
  ON public.customer_leads FOR SELECT
  USING (is_store_owner(store_id));

-- Store owners can delete leads
CREATE POLICY "Store owners can delete leads"
  ON public.customer_leads FOR DELETE
  USING (is_store_owner(store_id));

-- Anyone can insert leads (public storefront visitors)
CREATE POLICY "Anyone can insert leads"
  ON public.customer_leads FOR INSERT
  WITH CHECK (true);

-- Admins full access
CREATE POLICY "Admins can manage leads"
  ON public.customer_leads FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
