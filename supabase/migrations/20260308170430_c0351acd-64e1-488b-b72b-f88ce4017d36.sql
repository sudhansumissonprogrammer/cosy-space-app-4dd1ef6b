
-- Add whatsapp_number and banner_url to stores
ALTER TABLE public.stores ADD COLUMN whatsapp_number TEXT;
ALTER TABLE public.stores ADD COLUMN banner_url TEXT;

-- Create storage buckets for store assets
INSERT INTO storage.buckets (id, name, public) VALUES ('store-logos', 'store-logos', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('store-banners', 'store-banners', true);

-- Storage policies for store logos
CREATE POLICY "Anyone can view store logos" ON storage.objects FOR SELECT USING (bucket_id = 'store-logos');
CREATE POLICY "Authenticated users can upload store logos" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'store-logos' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own store logos" ON storage.objects FOR UPDATE USING (bucket_id = 'store-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own store logos" ON storage.objects FOR DELETE USING (bucket_id = 'store-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for store banners
CREATE POLICY "Anyone can view store banners" ON storage.objects FOR SELECT USING (bucket_id = 'store-banners');
CREATE POLICY "Authenticated users can upload store banners" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'store-banners' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update own store banners" ON storage.objects FOR UPDATE USING (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own store banners" ON storage.objects FOR DELETE USING (bucket_id = 'store-banners' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public can view any store (for storefront)
CREATE POLICY "Public can view stores" ON public.stores FOR SELECT TO anon USING (true);
-- Public can view active products (for storefront)
CREATE POLICY "Public can view active products" ON public.products FOR SELECT TO anon USING (is_active = true);
