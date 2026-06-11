CREATE TABLE public.landing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  phone text NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 20),
  business text CHECK (business IS NULL OR char_length(business) <= 100),
  city text CHECK (city IS NULL OR char_length(city) <= 100),
  page_path text CHECK (page_path IS NULL OR char_length(page_path) <= 500),
  referrer text CHECK (referrer IS NULL OR char_length(referrer) <= 500),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 500),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','converted','spam')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX landing_leads_created_at_idx ON public.landing_leads (created_at DESC);
CREATE INDEX landing_leads_phone_idx ON public.landing_leads (phone);

GRANT INSERT ON public.landing_leads TO anon;
GRANT INSERT ON public.landing_leads TO authenticated;
GRANT SELECT, UPDATE, DELETE ON public.landing_leads TO authenticated;
GRANT ALL ON public.landing_leads TO service_role;

ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

-- Anyone may insert a lead (public marketing form). No row-read possible.
CREATE POLICY "Anyone can submit a lead"
  ON public.landing_leads
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(name) BETWEEN 1 AND 100
    AND char_length(phone) BETWEEN 7 AND 20
    AND status = 'new'
  );

-- Only platform admins can read/manage leads. Uses existing has_role().
CREATE POLICY "Admins can view leads"
  ON public.landing_leads
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update leads"
  ON public.landing_leads
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete leads"
  ON public.landing_leads
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));