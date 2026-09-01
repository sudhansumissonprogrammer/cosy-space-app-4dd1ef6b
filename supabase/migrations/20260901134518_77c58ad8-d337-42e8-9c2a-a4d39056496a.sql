DO $$
DECLARE t text;
  tbls text[] := ARRAY[
    'products','product_reviews','orders','order_shipments','shipment_events',
    'store_theme_config','store_trust_videos','store_apps','store_pickup_addresses',
    'store_shipping_config','store_shipping_providers','store_tax_config',
    'store_notifications','customers','abandoned_carts','back_in_stock_waitlist',
    'whatsapp_orders','whatsapp_scheduled','whatsapp_optouts'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=t AND c.relkind='r') THEN
      EXECUTE format('DROP POLICY IF EXISTS "Admins can manage %1$s" ON public.%1$I', t);
      EXECUTE format($f$CREATE POLICY "Admins can manage %1$s" ON public.%1$I FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role))$f$, t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Admins can manage order_items" ON public.order_items;
CREATE POLICY "Admins can manage order_items" ON public.order_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;