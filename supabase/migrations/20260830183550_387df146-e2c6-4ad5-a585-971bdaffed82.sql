ALTER TABLE public.products ADD COLUMN IF NOT EXISTS award_badge boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_award_badge ON public.products (store_id) WHERE award_badge;