
-- Add media columns to whatsapp_messages
ALTER TABLE public.whatsapp_messages 
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text;

-- Create storage bucket for whatsapp media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('whatsapp-media', 'whatsapp-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for whatsapp-media bucket: store owners can upload
CREATE POLICY "Store owners can upload whatsapp media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');

-- Anyone can view whatsapp media (needed for display)
CREATE POLICY "Anyone can view whatsapp media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'whatsapp-media');

-- Store owners can delete whatsapp media
CREATE POLICY "Store owners can delete whatsapp media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'whatsapp-media');
