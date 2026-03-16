ALTER TABLE public.store_theme_config 
ADD COLUMN IF NOT EXISTS product_card_style text NOT NULL DEFAULT 'style-1',
ADD COLUMN IF NOT EXISTS category_style text NOT NULL DEFAULT 'style-1';