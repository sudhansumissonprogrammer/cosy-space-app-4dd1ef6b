
CREATE TABLE public.dashboard_menu_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_key text NOT NULL UNIQUE,
  menu_label text NOT NULL,
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'hidden', 'coming_soon')),
  display_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_menu_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read (merchants need to read this to know which menus to show)
CREATE POLICY "Anyone can read menu config" ON public.dashboard_menu_config
  FOR SELECT TO public USING (true);

-- Only admins can manage
CREATE POLICY "Admins can manage menu config" ON public.dashboard_menu_config
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed all dashboard menu items
INSERT INTO public.dashboard_menu_config (menu_key, menu_label, display_order) VALUES
  ('products', 'Products', 1),
  ('categories', 'Categories', 2),
  ('media_library', 'Media Library', 3),
  ('bulk_upload', 'Bulk Upload', 4),
  ('orders', 'Orders', 5),
  ('customers', 'Customers', 6),
  ('abandoned_carts', 'Abandoned Carts', 7),
  ('payments', 'Payments', 8),
  ('coupons', 'Coupons', 9),
  ('shipping', 'Shipping', 10),
  ('tax_gst', 'Tax / GST', 11),
  ('whatsapp_marketing', 'WhatsApp Marketing', 12),
  ('tracking_analytics', 'Tracking & Analytics', 13),
  ('theme', 'Theme', 14),
  ('domain', 'Domain', 15),
  ('store_settings', 'Store Settings', 16),
  ('leads', 'Customer Leads', 17),
  ('analytics', 'Analytics', 18);
