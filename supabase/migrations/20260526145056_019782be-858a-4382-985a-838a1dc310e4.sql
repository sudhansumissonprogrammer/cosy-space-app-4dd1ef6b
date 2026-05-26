-- Layer 5: merchant-editable SEO fields on stores
ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS seo_about_paragraph text,
  ADD COLUMN IF NOT EXISTS faq_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usp_bullets text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.stores.seo_about_paragraph IS 'Merchant-written 200-400 char paragraph used by hidden SEO body + /llms.txt + Organization JSON-LD description.';
COMMENT ON COLUMN public.stores.faq_items IS 'Array of {q,a} pairs powering FAQPage JSON-LD + bot /faq route.';
COMMENT ON COLUMN public.stores.usp_bullets IS '3-5 short "why choose us" bullets used by hidden SEO body.';