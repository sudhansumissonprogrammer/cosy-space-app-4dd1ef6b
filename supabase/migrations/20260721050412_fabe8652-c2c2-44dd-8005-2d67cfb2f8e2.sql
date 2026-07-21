
CREATE TABLE IF NOT EXISTS public.store_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, app_id)
);
CREATE INDEX IF NOT EXISTS idx_store_apps_store ON public.store_apps(store_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_apps TO authenticated;
GRANT ALL ON public.store_apps TO service_role;
ALTER TABLE public.store_apps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners manage store_apps" ON public.store_apps;
CREATE POLICY "Owners manage store_apps" ON public.store_apps
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_apps.store_id AND s.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_apps.store_id AND s.owner_id = auth.uid()));

DROP TRIGGER IF EXISTS trg_store_apps_updated ON public.store_apps;
CREATE TRIGGER trg_store_apps_updated BEFORE UPDATE ON public.store_apps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.store_app_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  app_id TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT '+91',
  marketing_opt_in BOOLEAN NOT NULL DEFAULT false,
  coupon_code TEXT,
  segment_label TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_store_app_leads_store_app ON public.store_app_leads(store_id, app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_app_leads_phone ON public.store_app_leads(store_id, phone);
GRANT SELECT ON public.store_app_leads TO authenticated;
GRANT ALL ON public.store_app_leads TO service_role;
ALTER TABLE public.store_app_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read store_app_leads" ON public.store_app_leads;
CREATE POLICY "Owners read store_app_leads" ON public.store_app_leads
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_app_leads.store_id AND s.owner_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.get_store_enabled_apps(_store_slug TEXT)
RETURNS TABLE(app_id TEXT, config JSONB)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sa.app_id, sa.config
  FROM public.store_apps sa
  JOIN public.stores s ON s.id = sa.store_id
  WHERE s.slug = _store_slug AND sa.enabled = true;
$$;
GRANT EXECUTE ON FUNCTION public.get_store_enabled_apps(TEXT) TO anon, authenticated;
