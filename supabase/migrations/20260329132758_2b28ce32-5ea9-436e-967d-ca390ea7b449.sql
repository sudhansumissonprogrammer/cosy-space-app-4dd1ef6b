
-- Create store_pages table
CREATE TABLE public.store_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  page_type text NOT NULL DEFAULT 'custom',
  title text NOT NULL,
  content text,
  image_url text,
  slug text,
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint for system pages (non-custom)
CREATE UNIQUE INDEX store_pages_system_unique ON public.store_pages (store_id, page_type) WHERE page_type != 'custom';

-- Enable RLS
ALTER TABLE public.store_pages ENABLE ROW LEVEL SECURITY;

-- Store owners can CRUD their own pages
CREATE POLICY "Store owners can manage pages" ON public.store_pages
  FOR ALL TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked())
  WITH CHECK (is_store_owner(store_id) AND NOT is_user_blocked());

-- Admins can manage all pages
CREATE POLICY "Admins can manage pages" ON public.store_pages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Public can read active pages
CREATE POLICY "Public can view active pages" ON public.store_pages
  FOR SELECT TO public
  USING (is_active = true);
