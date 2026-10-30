CREATE TABLE public.category_packaging_options (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
 category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
 label text NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 80),
 image_url text NOT NULL CHECK (image_url LIKE 'https://cdn.shopbanao.in/%' AND length(image_url) <= 2048),
 surcharge numeric(10,2) NOT NULL DEFAULT 0 CHECK (surcharge >= 0 AND surcharge <= 10000),
 is_active boolean NOT NULL DEFAULT true,
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(store_id, category_id)
);
GRANT SELECT ON public.category_packaging_options TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.category_packaging_options TO authenticated;
GRANT ALL ON public.category_packaging_options TO service_role;
ALTER TABLE public.category_packaging_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public active Utkal packaging" ON public.category_packaging_options FOR SELECT TO anon, authenticated USING (is_active AND store_id = 'ab19143d-87a9-490e-90b7-837313522782'::uuid);
CREATE POLICY "Utkal packaging owner management" ON public.category_packaging_options FOR ALL TO authenticated USING (store_id = 'ab19143d-87a9-490e-90b7-837313522782'::uuid AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))) WITH CHECK (store_id = 'ab19143d-87a9-490e-90b7-837313522782'::uuid AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND (s.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE FUNCTION public.validate_category_packaging() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NEW.store_id <> 'ab19143d-87a9-490e-90b7-837313522782'::uuid OR NOT EXISTS (SELECT 1 FROM public.categories c WHERE c.id = NEW.category_id AND c.store_id = NEW.store_id) THEN
 RAISE EXCEPTION 'Packaging category must belong to Utkal Watch';
 END IF;
 NEW.label := trim(NEW.label);
 NEW.updated_at := clock_timestamp();
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_category_packaging_trigger BEFORE INSERT OR UPDATE ON public.category_packaging_options FOR EACH ROW EXECUTE FUNCTION public.validate_category_packaging();
CREATE FUNCTION public.get_product_packaging(_store_id uuid, _product_id uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT to_jsonb(o) FROM public.category_packaging_options o
 JOIN public.product_categories pc ON pc.category_id = o.category_id AND pc.product_id = _product_id AND pc.store_id = _store_id
 JOIN public.products p ON p.id = pc.product_id AND p.store_id = _store_id
 WHERE o.store_id = _store_id AND _store_id = 'ab19143d-87a9-490e-90b7-837313522782'::uuid
 AND o.is_active AND p.is_active AND NOT coalesce(p.hidden_by_category, false)
 ORDER BY o.updated_at DESC, o.id ASC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_product_packaging(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_packaging(uuid, uuid) TO anon, authenticated, service_role;