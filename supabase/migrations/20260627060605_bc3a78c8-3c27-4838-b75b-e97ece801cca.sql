
CREATE OR REPLACE FUNCTION public._store_accepts_public_writes(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = _store_id
      AND COALESCE(s.is_suspended, false) = false
  );
$$;

GRANT EXECUTE ON FUNCTION public._store_accepts_public_writes(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can insert leads" ON public.customer_leads;
CREATE POLICY "Anyone can insert leads"
  ON public.customer_leads FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    public._store_accepts_public_writes(store_id)
    AND char_length(COALESCE(name, '')) <= 200
    AND char_length(COALESCE(phone, '')) <= 30
    AND char_length(COALESCE(product_name, '')) <= 300
  );
