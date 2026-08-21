ALTER TABLE public.store_theme_config
  ADD COLUMN IF NOT EXISTS dark_toggle_effect text NOT NULL DEFAULT 'spotlight';