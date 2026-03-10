
-- 1. Storefront customers table
CREATE TABLE public.storefront_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, store_id)
);

ALTER TABLE public.storefront_customers ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is the storefront customer
CREATE OR REPLACE FUNCTION public.is_storefront_customer(_customer_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.storefront_customers
    WHERE id = _customer_id AND user_id = auth.uid()
  )
$$;

-- Customers can view/update their own row
CREATE POLICY "Customers can view own row" ON public.storefront_customers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Customers can update own row" ON public.storefront_customers
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Customers can insert own row" ON public.storefront_customers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Store owners can view their store's customers
CREATE POLICY "Store owners can view storefront customers" ON public.storefront_customers
  FOR SELECT TO authenticated USING (is_store_owner(store_id));

-- Admins full access
CREATE POLICY "Admins can manage storefront customers" ON public.storefront_customers
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Customer addresses table
CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_customer_id uuid NOT NULL REFERENCES public.storefront_customers(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  full_name text,
  phone text,
  street_address text,
  city text,
  state text,
  pincode text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can CRUD own addresses" ON public.customer_addresses
  FOR ALL TO authenticated
  USING (is_storefront_customer(storefront_customer_id))
  WITH CHECK (is_storefront_customer(storefront_customer_id));

CREATE POLICY "Store owners can view addresses" ON public.customer_addresses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.storefront_customers sc
    WHERE sc.id = customer_addresses.storefront_customer_id
    AND is_store_owner(sc.store_id)
  ));

-- 3. Customer wishlists table
CREATE TABLE public.customer_wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storefront_customer_id uuid NOT NULL REFERENCES public.storefront_customers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (storefront_customer_id, product_id)
);

ALTER TABLE public.customer_wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can CRUD own wishlists" ON public.customer_wishlists
  FOR ALL TO authenticated
  USING (is_storefront_customer(storefront_customer_id))
  WITH CHECK (is_storefront_customer(storefront_customer_id));

-- 4. Add storefront_customer_id to orders
ALTER TABLE public.orders ADD COLUMN storefront_customer_id uuid REFERENCES public.storefront_customers(id);

-- 5. Policy: customers can view their own orders
CREATE POLICY "Storefront customers can view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (storefront_customer_id IS NOT NULL AND is_storefront_customer(storefront_customer_id));
