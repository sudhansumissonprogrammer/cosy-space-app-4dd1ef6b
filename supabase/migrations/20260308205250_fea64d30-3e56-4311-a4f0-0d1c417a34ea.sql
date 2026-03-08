
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS city text DEFAULT null;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS state text DEFAULT null;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS instagram_url text DEFAULT null;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS facebook_url text DEFAULT null;
