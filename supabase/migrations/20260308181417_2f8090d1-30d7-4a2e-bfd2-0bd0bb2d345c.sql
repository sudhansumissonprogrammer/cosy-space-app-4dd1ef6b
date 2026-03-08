
-- 1. Multi-image products table
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product_id ON public.product_images(product_id);

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Public can view images of active products
CREATE POLICY "Public can view product images" ON public.product_images
  FOR SELECT USING (true);

-- Store owners can manage images via product ownership
CREATE POLICY "Store owners can manage product images" ON public.product_images
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = product_images.product_id AND s.owner_id = auth.uid()
    )
    AND NOT public.is_user_blocked()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = product_images.product_id AND s.owner_id = auth.uid()
    )
    AND NOT public.is_user_blocked()
  );

CREATE POLICY "Admins can manage product images" ON public.product_images
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 2. Page views tracking table
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  path text,
  visitor_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_page_views_store_id ON public.page_views(store_id);
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Anyone can insert views (public storefront)
CREATE POLICY "Anyone can insert page views" ON public.page_views
  FOR INSERT WITH CHECK (true);

-- Store owners can view their own page views
CREATE POLICY "Store owners can view page views" ON public.page_views
  FOR SELECT TO authenticated
  USING (public.is_store_owner(store_id));

-- Admins can view all
CREATE POLICY "Admins can view all page views" ON public.page_views
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 3. Function to get store view count
CREATE OR REPLACE FUNCTION public.get_store_views(_store_ids uuid[])
RETURNS TABLE(store_id uuid, view_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pv.store_id, COUNT(*) as view_count
  FROM public.page_views pv
  WHERE pv.store_id = ANY(_store_ids)
  GROUP BY pv.store_id
$$;
