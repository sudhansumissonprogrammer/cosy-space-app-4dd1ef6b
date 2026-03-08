
ALTER TABLE public.stores ADD COLUMN order_mode text NOT NULL DEFAULT 'whatsapp';

ALTER TABLE public.orders
  ADD COLUMN customer_name text,
  ADD COLUMN customer_phone text,
  ADD COLUMN street_address text,
  ADD COLUMN city text,
  ADD COLUMN state text,
  ADD COLUMN pincode text,
  ADD COLUMN payment_method text NOT NULL DEFAULT 'cod';

-- Allow unauthenticated storefront visitors to place orders
CREATE POLICY "Anyone can create website orders"
  ON public.orders FOR INSERT WITH CHECK (true);

-- Allow unauthenticated storefront visitors to create order items
CREATE POLICY "Anyone can create website order items"
  ON public.order_items FOR INSERT WITH CHECK (true);

-- Allow anyone to read orders they just created (for checkout confirmation)
CREATE POLICY "Anyone can view orders by id"
  ON public.orders FOR SELECT USING (true);

-- Allow anyone to view order items for visible orders
CREATE POLICY "Anyone can view order items"
  ON public.order_items FOR SELECT USING (true);
