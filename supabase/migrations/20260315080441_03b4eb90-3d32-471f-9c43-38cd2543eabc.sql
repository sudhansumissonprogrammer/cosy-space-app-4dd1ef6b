
-- Add unique constraint for template upsert (store_id + template_name)
ALTER TABLE public.whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_store_template_name_key;
ALTER TABLE public.whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_store_template_name_key UNIQUE (store_id, template_name);
