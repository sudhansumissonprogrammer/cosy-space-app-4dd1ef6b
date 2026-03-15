ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'outgoing',
ADD COLUMN IF NOT EXISTS sender_phone text;