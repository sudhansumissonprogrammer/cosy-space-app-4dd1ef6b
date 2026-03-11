
ALTER TABLE public.stores 
ADD COLUMN IF NOT EXISTS meta_title text,
ADD COLUMN IF NOT EXISTS meta_description text,
ADD COLUMN IF NOT EXISTS og_image_url text;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS tracking_number text,
ADD COLUMN IF NOT EXISTS tracking_url text;

CREATE TABLE public.store_shipping_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL UNIQUE,
  flat_rate numeric NOT NULL DEFAULT 0,
  free_shipping_above numeric,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.store_shipping_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage shipping config" ON public.store_shipping_config
  FOR ALL TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked())
  WITH CHECK (is_store_owner(store_id) AND NOT is_user_blocked());

CREATE POLICY "Public can view shipping config" ON public.store_shipping_config
  FOR SELECT TO anon
  USING (true);

CREATE TABLE public.store_tax_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tax_name text NOT NULL DEFAULT 'Tax',
  tax_rate numeric NOT NULL DEFAULT 0,
  is_inclusive boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.store_tax_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage tax config" ON public.store_tax_config
  FOR ALL TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked())
  WITH CHECK (is_store_owner(store_id) AND NOT is_user_blocked());

CREATE POLICY "Public can view tax config" ON public.store_tax_config
  FOR SELECT TO anon
  USING (true);

CREATE TABLE public.abandoned_carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  customer_email text,
  customer_phone text,
  cart_items jsonb NOT NULL DEFAULT '[]',
  recovered boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.abandoned_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage abandoned carts" ON public.abandoned_carts
  FOR ALL TO authenticated
  USING (is_store_owner(store_id))
  WITH CHECK (is_store_owner(store_id));

CREATE POLICY "Anyone can insert abandoned carts" ON public.abandoned_carts
  FOR INSERT TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can update abandoned carts" ON public.abandoned_carts
  FOR UPDATE TO public
  USING (true);
