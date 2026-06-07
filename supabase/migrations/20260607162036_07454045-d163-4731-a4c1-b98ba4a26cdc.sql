ALTER TABLE public.store_theme_config
ADD COLUMN IF NOT EXISTS show_trust_badges boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS trust_badges jsonb NOT NULL DEFAULT '[{"emoji":"🌙","label":"Daily Wear"},{"emoji":"🏢","label":"Office"},{"emoji":"🎓","label":"College"},{"emoji":"🎉","label":"Party"},{"emoji":"🪔","label":"Festive"},{"emoji":"👰","label":"Wedding"}]'::jsonb;