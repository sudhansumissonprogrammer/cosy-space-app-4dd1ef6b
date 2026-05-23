
-- 1. STORES: remove broad anon/authenticated SELECT, keep owner + admin
DROP POLICY IF EXISTS "Anon can view active stores limited" ON public.stores;
DROP POLICY IF EXISTS "Authenticated can view active stores limited" ON public.stores;

-- 2. STORE_NOTIFICATIONS: scope SELECT to store owner / admin
DROP POLICY IF EXISTS "Public can read notifications" ON public.store_notifications;

CREATE POLICY "Store owners can read own notifications"
ON public.store_notifications
FOR SELECT
TO authenticated
USING (
  public.is_store_owner(store_id)
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 3. STORAGE: require uploader to own at least one store, in addition to folder = own uid
DROP POLICY IF EXISTS "Authenticated users can upload store logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload store banners" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;

CREATE POLICY "Store owners can upload store logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.stores WHERE owner_id = auth.uid())
);

CREATE POLICY "Store owners can upload store banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'store-banners'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.stores WHERE owner_id = auth.uid())
);

CREATE POLICY "Store owners can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.stores WHERE owner_id = auth.uid())
);
