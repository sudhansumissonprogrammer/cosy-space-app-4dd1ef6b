ALTER TABLE public.store_theme_config
  ADD COLUMN IF NOT EXISTS header_bg_color text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS header_text_color text NOT NULL DEFAULT '';