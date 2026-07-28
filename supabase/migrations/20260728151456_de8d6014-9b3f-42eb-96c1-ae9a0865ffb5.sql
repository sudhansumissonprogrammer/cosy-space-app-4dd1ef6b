CREATE TABLE public.store_trust_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  poster_url TEXT,
  title TEXT,
  cta_label TEXT NOT NULL DEFAULT 'See more details',
  cta_target TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_store_trust_videos_store ON public.store_trust_videos(store_id, sort_order);

GRANT SELECT ON public.store_trust_videos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_trust_videos TO authenticated;
GRANT ALL ON public.store_trust_videos TO service_role;

ALTER TABLE public.store_trust_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active trust videos"
ON public.store_trust_videos FOR SELECT
USING (is_active = true);

CREATE POLICY "Owners can view their trust videos"
ON public.store_trust_videos FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners can insert their trust videos"
ON public.store_trust_videos FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners can update their trust videos"
ON public.store_trust_videos FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

CREATE POLICY "Owners can delete their trust videos"
ON public.store_trust_videos FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid()));

CREATE TRIGGER trg_store_trust_videos_updated_at
BEFORE UPDATE ON public.store_trust_videos
FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

ALTER TABLE public.store_theme_config
  ADD COLUMN IF NOT EXISTS auto_hide_chrome BOOLEAN NOT NULL DEFAULT true;