ALTER TABLE public.store_shipping_providers
  DROP CONSTRAINT IF EXISTS store_shipping_providers_provider_check;

ALTER TABLE public.store_shipping_providers
  ADD CONSTRAINT store_shipping_providers_provider_check
  CHECK (provider = ANY (ARRAY['shiprocket'::text, 'delhivery'::text, 'ekart'::text, 'bluedart'::text]));