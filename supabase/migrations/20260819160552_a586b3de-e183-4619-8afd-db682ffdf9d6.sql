ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS source_platform text,
  ADD COLUMN IF NOT EXISTS source_base_url text;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_path text;

UPDATE public.stores SET source_platform = 'jdwebship'
WHERE source_sync_enabled = true AND source_platform IS NULL;

DELETE FROM public.product_images pi
USING public.products p
WHERE pi.product_id = p.id AND p.store_id = 'd07b0784-4103-494e-b243-8fcbdf5fd473';

DELETE FROM public.product_variants pv
USING public.products p
WHERE pv.product_id = p.id AND p.store_id = 'd07b0784-4103-494e-b243-8fcbdf5fd473';

DELETE FROM public.products WHERE store_id = 'd07b0784-4103-494e-b243-8fcbdf5fd473';
DELETE FROM public.categories WHERE store_id = 'd07b0784-4103-494e-b243-8fcbdf5fd473';

UPDATE public.stores
SET source_platform = 'cartpe',
    source_base_url = 'https://thewristlife.cartpe.in',
    source_sync_enabled = true
WHERE id = 'd07b0784-4103-494e-b243-8fcbdf5fd473';

DELETE FROM public.jd_sync_state WHERE store_id = 'd07b0784-4103-494e-b243-8fcbdf5fd473';