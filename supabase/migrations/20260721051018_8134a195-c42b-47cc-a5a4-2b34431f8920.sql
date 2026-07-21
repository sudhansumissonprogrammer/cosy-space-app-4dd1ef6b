CREATE TABLE public.store_shipping_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('shiprocket','delhivery','ekart')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sandbox BOOLEAN NOT NULL DEFAULT false,
  api_email TEXT,
  api_password TEXT,
  api_key TEXT,
  api_secret TEXT,
  client_id TEXT,
  cached_token TEXT,
  token_expires_at TIMESTAMPTZ,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_shipping_providers TO authenticated;
GRANT ALL ON public.store_shipping_providers TO service_role;
ALTER TABLE public.store_shipping_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own shipping providers"
ON public.store_shipping_providers FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
CREATE INDEX idx_ship_providers_store ON public.store_shipping_providers(store_id);

CREATE TABLE public.store_pickup_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  is_default BOOLEAN NOT NULL DEFAULT false,
  shiprocket_pickup_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_pickup_addresses TO authenticated;
GRANT ALL ON public.store_pickup_addresses TO service_role;
ALTER TABLE public.store_pickup_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage own pickup addresses"
ON public.store_pickup_addresses FOR ALL
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
CREATE INDEX idx_pickup_addr_store ON public.store_pickup_addresses(store_id);

CREATE TABLE public.order_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('shiprocket','delhivery','ekart','manual')),
  courier_name TEXT,
  provider_shipment_id TEXT,
  provider_order_id TEXT,
  awb TEXT,
  tracking_url TEXT,
  label_url TEXT,
  manifest_url TEXT,
  invoice_url TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  status_updated_at TIMESTAMPTZ,
  weight_grams INTEGER,
  length_cm NUMERIC,
  breadth_cm NUMERIC,
  height_cm NUMERIC,
  declared_value NUMERIC,
  rate NUMERIC,
  cod_amount NUMERIC DEFAULT 0,
  payment_mode TEXT,
  pickup_address_id UUID REFERENCES public.store_pickup_addresses(id),
  raw_payload JSONB,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_shipments TO authenticated;
GRANT ALL ON public.order_shipments TO service_role;
ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view own order shipments" ON public.order_shipments FOR SELECT
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners insert own order shipments" ON public.order_shipments FOR INSERT
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners update own order shipments" ON public.order_shipments FOR UPDATE
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
CREATE POLICY "Owners delete own order shipments" ON public.order_shipments FOR DELETE
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));
CREATE INDEX idx_shipments_order ON public.order_shipments(order_id);
CREATE INDEX idx_shipments_store ON public.order_shipments(store_id);
CREATE INDEX idx_shipments_awb ON public.order_shipments(awb) WHERE awb IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_ship_providers_updated BEFORE UPDATE ON public.store_shipping_providers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pickup_addr_updated BEFORE UPDATE ON public.store_pickup_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_shipments_updated BEFORE UPDATE ON public.order_shipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();