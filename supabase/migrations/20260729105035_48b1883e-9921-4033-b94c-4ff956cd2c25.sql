CREATE INDEX IF NOT EXISTS idx_orders_customer_phone_created
  ON public.orders (customer_phone, created_at DESC)
  WHERE street_address IS NOT NULL AND pincode IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_storefront_customers_phone
  ON public.storefront_customers (phone);

CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer
  ON public.customer_addresses (storefront_customer_id, is_default DESC, created_at DESC);