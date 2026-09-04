CREATE TABLE public.store_ai_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_by uuid,
  source_image_url text,
  image_url text NOT NULL,
  prompt text,
  preset text,
  aspect text,
  attached boolean NOT NULL DEFAULT false,
  product_image_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_ai_creatives_store ON public.store_ai_creatives (store_id, created_at DESC);
CREATE INDEX idx_store_ai_creatives_product ON public.store_ai_creatives (product_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_ai_creatives TO authenticated;
GRANT ALL ON public.store_ai_creatives TO service_role;

ALTER TABLE public.store_ai_creatives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners manage their AI creatives"
ON public.store_ai_creatives FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_ai_creatives.store_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_ai_creatives.store_id AND s.owner_id = auth.uid()));

CREATE POLICY "Admins manage AI creatives"
ON public.store_ai_creatives FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));