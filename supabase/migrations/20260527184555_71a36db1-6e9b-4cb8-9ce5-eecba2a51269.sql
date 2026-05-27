
-- store_shipping_config
DROP POLICY IF EXISTS "Authenticated can view shipping config" ON public.store_shipping_config;
DROP POLICY IF EXISTS "Owners view own shipping config" ON public.store_shipping_config;
CREATE POLICY "Public can view shipping config for active stores"
ON public.store_shipping_config FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_shipping_config.store_id AND s.is_suspended = false));

-- store_tax_config
DROP POLICY IF EXISTS "Authenticated can view tax config" ON public.store_tax_config;
DROP POLICY IF EXISTS "Owners view own tax config" ON public.store_tax_config;
CREATE POLICY "Public can view tax config for active stores"
ON public.store_tax_config FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_tax_config.store_id AND s.is_suspended = false));

-- store_theme_config
DROP POLICY IF EXISTS "Authenticated can view theme config" ON public.store_theme_config;
DROP POLICY IF EXISTS "Public can view theme config" ON public.store_theme_config;
CREATE POLICY "Public can view theme config for active stores"
ON public.store_theme_config FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_theme_config.store_id AND s.is_suspended = false));
