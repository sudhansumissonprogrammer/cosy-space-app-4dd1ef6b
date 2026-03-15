
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS meta_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS meta_template_id text,
  ADD COLUMN IF NOT EXISTS meta_category text NOT NULL DEFAULT 'MARKETING',
  ADD COLUMN IF NOT EXISTS meta_rejected_reason text;
