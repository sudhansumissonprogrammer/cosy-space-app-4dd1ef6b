
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_alt text;

-- Backfill: use product name as the default alt where missing.
UPDATE public.products
SET image_alt = name
WHERE image_alt IS NULL OR image_alt = '';

-- Add image_alt to product_images too, with same backfill from parent product name.
ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS image_alt text;

UPDATE public.product_images pi
SET image_alt = p.name
FROM public.products p
WHERE pi.product_id = p.id
  AND (pi.image_alt IS NULL OR pi.image_alt = '');
