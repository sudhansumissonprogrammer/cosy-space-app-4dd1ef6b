ALTER TABLE public.store_theme_config DROP COLUMN transparent_header;
ALTER TABLE public.store_theme_config ADD COLUMN header_style text NOT NULL DEFAULT 'normal';