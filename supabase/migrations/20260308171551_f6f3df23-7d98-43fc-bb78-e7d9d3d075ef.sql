
-- WhatsApp order logs (public-facing, no auth required for insert)
CREATE TABLE public.whatsapp_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_price NUMERIC(10,2) NOT NULL,
  customer_phone TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','shipped','delivered','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_orders_store ON public.whatsapp_orders(store_id);
CREATE INDEX idx_whatsapp_orders_created ON public.whatsapp_orders(created_at DESC);

ALTER TABLE public.whatsapp_orders ENABLE ROW LEVEL SECURITY;

-- Store owners can view/manage their orders
CREATE POLICY "Store owners can view whatsapp orders" ON public.whatsapp_orders FOR SELECT USING (public.is_store_owner(store_id));
CREATE POLICY "Store owners can update whatsapp orders" ON public.whatsapp_orders FOR UPDATE USING (public.is_store_owner(store_id));
CREATE POLICY "Store owners can delete whatsapp orders" ON public.whatsapp_orders FOR DELETE USING (public.is_store_owner(store_id));

-- Anyone can create an order (public storefront)
CREATE POLICY "Anyone can create whatsapp orders" ON public.whatsapp_orders FOR INSERT TO anon, authenticated WITH CHECK (true);
