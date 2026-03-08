
-- Add missing columns to products
ALTER TABLE public.products ADD COLUMN slug TEXT;
ALTER TABLE public.products ADD COLUMN sale_price NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN category TEXT;

-- Add unique constraint on store_id + slug
CREATE UNIQUE INDEX idx_products_store_slug ON public.products(store_id, slug);

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Storage policies for product images
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Authenticated users can upload product images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own product images" ON storage.objects FOR UPDATE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own product images" ON storage.objects FOR DELETE USING (bucket_id = 'product-images' AND auth.uid()::text = (storage.foldername(name))[1]);
