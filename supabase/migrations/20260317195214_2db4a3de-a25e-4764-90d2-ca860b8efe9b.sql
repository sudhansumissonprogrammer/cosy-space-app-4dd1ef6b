
-- Store notifications table for admin-to-customer push notifications
CREATE TABLE public.store_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL,
  link_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.store_notifications ENABLE ROW LEVEL SECURITY;

-- Store owners can CRUD their own notifications
CREATE POLICY "Store owners can manage notifications"
  ON public.store_notifications FOR ALL TO authenticated
  USING (is_store_owner(store_id))
  WITH CHECK (is_store_owner(store_id));

-- Public can read notifications (for storefront realtime)
CREATE POLICY "Public can read notifications"
  ON public.store_notifications FOR SELECT TO public
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_notifications;
