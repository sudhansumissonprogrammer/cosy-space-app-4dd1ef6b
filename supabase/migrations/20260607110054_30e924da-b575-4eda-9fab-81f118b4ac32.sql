ALTER TABLE public.store_theme_config ADD COLUMN IF NOT EXISTS show_warranty_badge boolean NOT NULL DEFAULT false;

-- Enable for imitationworld store
INSERT INTO public.store_theme_config (store_id, show_warranty_badge)
SELECT id, true FROM public.stores WHERE slug = 'imitationworld'
ON CONFLICT (store_id) DO UPDATE SET show_warranty_badge = true;