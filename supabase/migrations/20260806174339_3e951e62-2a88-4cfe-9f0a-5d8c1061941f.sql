CREATE INDEX IF NOT EXISTS idx_wa_queue_phone_type_status_created
  ON public.wa_send_queue (recipient_phone, message_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id_incl
  ON public.order_items (order_id, id);