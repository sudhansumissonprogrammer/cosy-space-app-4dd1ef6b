ALTER TABLE public.product_reviews
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.product_reviews
  DROP CONSTRAINT product_reviews_product_id_fkey;

ALTER TABLE public.product_reviews
  ADD CONSTRAINT product_reviews_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES public.products(id)
  ON DELETE SET NULL;