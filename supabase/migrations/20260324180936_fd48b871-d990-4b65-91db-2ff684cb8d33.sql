-- Non-destructive indexes for query performance optimization
-- ProductDetail: lookup by slug + store_id
CREATE INDEX IF NOT EXISTS idx_products_store_slug ON products(store_id, slug);

-- CategoryDetail: filter by category name + store (partial index for active only)
CREATE INDEX IF NOT EXISTS idx_products_store_category ON products(store_id, category) WHERE is_active = true;

-- StorefrontShop: paginated active products sorted by created_at
CREATE INDEX IF NOT EXISTS idx_products_store_active_created ON products(store_id, created_at DESC) WHERE is_active = true;

-- Orders: status filter (dashboard pending count)
CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status);

-- Orders: date range queries (analytics)
CREATE INDEX IF NOT EXISTS idx_orders_store_created ON orders(store_id, created_at);

-- CustomerLeads: store listing sorted by date
CREATE INDEX IF NOT EXISTS idx_customer_leads_store_created ON customer_leads(store_id, created_at DESC);

-- Abandoned carts: store + recovered filter
CREATE INDEX IF NOT EXISTS idx_abandoned_carts_store ON abandoned_carts(store_id, recovered);