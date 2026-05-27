REVOKE SELECT (cost_price) ON public.products FROM anon;
REVOKE SELECT (cost_price) ON public.products FROM authenticated;

REVOKE SELECT (access_token) ON public.whatsapp_config FROM anon;
REVOKE SELECT (access_token) ON public.whatsapp_config FROM authenticated;

DROP POLICY IF EXISTS "Public can view shipping config" ON public.store_shipping_config;
DROP POLICY IF EXISTS "Anyone can view shipping config" ON public.store_shipping_config;
DROP POLICY IF EXISTS "shipping_config_select" ON public.store_shipping_config;
CREATE POLICY "Owners view own shipping config"
ON public.store_shipping_config
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_shipping_config.store_id AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Public can view tax config" ON public.store_tax_config;
DROP POLICY IF EXISTS "Anyone can view tax config" ON public.store_tax_config;
DROP POLICY IF EXISTS "tax_config_select" ON public.store_tax_config;
CREATE POLICY "Owners view own tax config"
ON public.store_tax_config
FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_tax_config.store_id AND s.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can update theme config" ON public.store_theme_config;
DROP POLICY IF EXISTS "Public can update theme config" ON public.store_theme_config;
CREATE POLICY "Owners modify own theme config"
ON public.store_theme_config
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_theme_config.store_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_theme_config.store_id AND s.owner_id = auth.uid()));
