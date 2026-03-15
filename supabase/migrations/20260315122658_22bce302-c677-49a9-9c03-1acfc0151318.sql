
-- Add marketing_mode to whatsapp_config
ALTER TABLE public.whatsapp_config 
  ADD COLUMN IF NOT EXISTS marketing_mode text NOT NULL DEFAULT 'storivo';

-- Add platform-level WhatsApp credentials to platform_config
ALTER TABLE public.platform_config 
  ADD COLUMN IF NOT EXISTS wa_phone_number_id text,
  ADD COLUMN IF NOT EXISTS wa_access_token text,
  ADD COLUMN IF NOT EXISTS wa_business_phone text;

-- Make access_token and phone_number_id nullable for storivo mode configs
ALTER TABLE public.whatsapp_config 
  ALTER COLUMN access_token DROP NOT NULL,
  ALTER COLUMN phone_number_id DROP NOT NULL;

-- Set defaults for storivo mode
ALTER TABLE public.whatsapp_config 
  ALTER COLUMN access_token SET DEFAULT '',
  ALTER COLUMN phone_number_id SET DEFAULT '';
