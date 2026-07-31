DROP INDEX IF EXISTS public.whatsapp_messages_one_cart_recovery;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_meta_id_uniq
  ON public.whatsapp_messages (meta_message_id)
  WHERE meta_message_id IS NOT NULL;