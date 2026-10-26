CREATE TABLE public.ui_translations (
  lang text NOT NULL CHECK (lang IN ('hi','hinglish')),
  src_hash text NOT NULL,
  src_text text NOT NULL,
  translated text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lang, src_hash)
);
GRANT SELECT ON public.ui_translations TO anon, authenticated;
GRANT ALL ON public.ui_translations TO service_role;
ALTER TABLE public.ui_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read translations" ON public.ui_translations FOR SELECT USING (true);