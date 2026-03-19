CREATE TABLE public.media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL DEFAULT '',
  file_size integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.media_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage media" ON public.media_library
  FOR ALL TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked())
  WITH CHECK (is_store_owner(store_id) AND NOT is_user_blocked());

CREATE POLICY "Admins can manage media" ON public.media_library
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can delete media" ON public.media_library
  FOR DELETE USING (auth.role() = 'service_role');