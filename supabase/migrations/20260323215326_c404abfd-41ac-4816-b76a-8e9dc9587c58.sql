
-- =============================================
-- SCALING INDEXES: Optimize for 50-100+ stores
-- =============================================

-- Products: Most queried table - filter by store + active status
CREATE INDEX IF NOT EXISTS idx_products_store_active 
  ON public.products (store_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_store_category 
  ON public.products (store_id, category) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_products_store_bestselling 
  ON public.products (store_id, is_best_selling DESC, created_at DESC) 
  WHERE is_active = true;

-- Orders: Heavy reads by store owner + status filtering
CREATE INDEX IF NOT EXISTS idx_orders_store_created 
  ON public.orders (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_store_status 
  ON public.orders (store_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_storefront_customer 
  ON public.orders (storefront_customer_id) 
  WHERE storefront_customer_id IS NOT NULL;

-- Order Items: Always joined with orders
CREATE INDEX IF NOT EXISTS idx_order_items_order 
  ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product 
  ON public.order_items (product_id) 
  WHERE product_id IS NOT NULL;

-- Page Views: Analytics queries by store + date range
CREATE INDEX IF NOT EXISTS idx_page_views_store_created 
  ON public.page_views (store_id, created_at DESC);

-- Customers: Looked up by store
CREATE INDEX IF NOT EXISTS idx_customers_store 
  ON public.customers (store_id);

CREATE INDEX IF NOT EXISTS idx_customers_store_email 
  ON public.customers (store_id, email);

-- Categories: Always filtered by store
CREATE INDEX IF NOT EXISTS idx_categories_store 
  ON public.categories (store_id);

-- Stores: Slug lookup is the hottest path (every storefront load)
CREATE INDEX IF NOT EXISTS idx_stores_slug 
  ON public.stores (slug);

CREATE INDEX IF NOT EXISTS idx_stores_owner 
  ON public.stores (owner_id);

CREATE INDEX IF NOT EXISTS idx_stores_custom_domain 
  ON public.stores (custom_domain) 
  WHERE custom_domain IS NOT NULL;

-- Product Images: Always joined with products
CREATE INDEX IF NOT EXISTS idx_product_images_product 
  ON public.product_images (product_id, display_order);

-- Product Variants: Always joined with products
CREATE INDEX IF NOT EXISTS idx_product_variants_product 
  ON public.product_variants (product_id) 
  WHERE is_active = true;

-- Storefront Customers: Login/lookup
CREATE INDEX IF NOT EXISTS idx_storefront_customers_user_store 
  ON public.storefront_customers (user_id, store_id);

-- Abandoned Carts: Store owner dashboard
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_store 
  ON public.abandoned_carts (store_id, created_at DESC) 
  WHERE recovered = false;

-- Coupons: Public lookup by store + active
CREATE INDEX IF NOT EXISTS idx_coupons_store_active 
  ON public.coupons (store_id) 
  WHERE is_active = true;

-- WhatsApp Messages: Store dashboard
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_store 
  ON public.whatsapp_messages (store_id, created_at DESC);

-- Customer Leads: Store dashboard
CREATE INDEX IF NOT EXISTS idx_customer_leads_store 
  ON public.customer_leads (store_id, created_at DESC);

-- Profiles: User lookup
CREATE INDEX IF NOT EXISTS idx_profiles_user 
  ON public.profiles (user_id);

-- Media Library: Store owner browsing
CREATE INDEX IF NOT EXISTS idx_media_library_store 
  ON public.media_library (store_id, created_at DESC);

-- Store configs: All 1:1 with store_id
CREATE INDEX IF NOT EXISTS idx_store_theme_config_store 
  ON public.store_theme_config (store_id);

CREATE INDEX IF NOT EXISTS idx_store_payment_config_store 
  ON public.store_payment_config (store_id);

CREATE INDEX IF NOT EXISTS idx_store_shipping_config_store 
  ON public.store_shipping_config (store_id);

CREATE INDEX IF NOT EXISTS idx_store_tax_config_store 
  ON public.store_tax_config (store_id);

-- Subscriptions: User plan lookup
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status 
  ON public.subscriptions (user_id, status) 
  WHERE status = 'active';

-- Store Plan Assignments: Active plan lookup
CREATE INDEX IF NOT EXISTS idx_store_plan_assignments_store 
  ON public.store_plan_assignments (store_id, status) 
  WHERE status = 'active';
