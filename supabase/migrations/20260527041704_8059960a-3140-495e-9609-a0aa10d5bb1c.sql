ALTER TABLE public.store_theme_config
ADD COLUMN IF NOT EXISTS nav_icons jsonb NOT NULL DEFAULT '{}'::jsonb;