CREATE TABLE public.store_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  city TEXT NOT NULL,
  slug TEXT NOT NULL,
  location_type TEXT NOT NULL DEFAULT 'delivery_only',
  store_name TEXT,
  address_line TEXT,
  pincode TEXT,
  latitude NUMERIC,
  longitude NUMERIC,
  map_url TEXT,
  phone TEXT,
  whatsapp TEXT,
  opening_hours JSONB,
  photos TEXT[] NOT NULL DEFAULT '{}',
  walk_in BOOLEAN,
  pickup_available BOOLEAN,
  pickup_notes TEXT,
  delivery_notes TEXT,
  returns_notes TEXT,
  local_inventory_source TEXT,
  central_dispatch BOOLEAN NOT NULL DEFAULT true,
  intro TEXT,
  content_verified_at TIMESTAMPTZ,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);

GRANT SELECT ON public.store_locations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_locations TO authenticated;
GRANT ALL ON public.store_locations TO service_role;

ALTER TABLE public.store_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public reads published locations"
  ON public.store_locations FOR SELECT TO anon, authenticated
  USING (is_published = true);

CREATE POLICY "Owners manage their store locations"
  ON public.store_locations FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()))
  WITH CHECK (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

CREATE POLICY "Service role full access"
  ON public.store_locations FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER store_locations_touch_updated_at
  BEFORE UPDATE ON public.store_locations
  FOR EACH ROW EXECUTE FUNCTION public._touch_updated_at();

-- Utkal Watches: 20 owner-provided cities. Only verified facts are seeded:
-- Rajkot main store (address/hours/WhatsApp from the store record); the other
-- 19 are delivery-only coverage pages with central dispatch from Rajkot.
INSERT INTO public.store_locations (store_id, city, slug, location_type, address_line, whatsapp, opening_hours, central_dispatch, content_verified_at, is_published) VALUES
  ('ab19143d-87a9-490e-90b7-837313522782', 'Rajkot', 'rajkot', 'main_store', 'Sant Kabir Main Rd, Rajkot, Gujarat', '7978394101', '{"mon":"10:00 AM - 7:00 PM","tue":"10:00 AM - 7:00 PM","wed":"10:00 AM - 7:00 PM","thu":"10:00 AM - 7:00 PM","fri":"10:00 AM - 7:00 PM","sat":"10:00 AM - 7:00 PM","sun":"10:00 AM - 7:00 PM"}'::jsonb, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Mumbai', 'mumbai', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Delhi', 'delhi', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Bengaluru', 'bengaluru', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Hyderabad', 'hyderabad', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Chennai', 'chennai', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Kolkata', 'kolkata', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Pune', 'pune', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Ahmedabad', 'ahmedabad', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Surat', 'surat', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Jaipur', 'jaipur', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Lucknow', 'lucknow', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Kanpur', 'kanpur', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Nagpur', 'nagpur', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Indore', 'indore', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Bhopal', 'bhopal', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Chandigarh', 'chandigarh', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Patna', 'patna', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Vadodara', 'vadodara', 'delivery_only', NULL, NULL, NULL, true, now(), true),
  ('ab19143d-87a9-490e-90b7-837313522782', 'Bhubaneswar', 'bhubaneswar', 'delivery_only', NULL, NULL, NULL, true, now(), true);