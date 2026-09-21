CREATE UNIQUE INDEX customer_addresses_one_current_per_customer
ON public.customer_addresses (storefront_customer_id);

CREATE OR REPLACE FUNCTION public.replace_customer_address(
  _storefront_customer_id uuid,
  _label text,
  _full_name text,
  _phone text,
  _street_address text,
  _city text,
  _state text,
  _pincode text
)
RETURNS SETOF public.customer_addresses
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.storefront_customers sc
    WHERE sc.id = _storefront_customer_id
      AND sc.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not allowed to change this address';
  END IF;

  IF btrim(coalesce(_full_name, '')) = ''
     OR btrim(coalesce(_street_address, '')) = ''
     OR btrim(coalesce(_city, '')) = ''
     OR btrim(coalesce(_state, '')) = ''
     OR btrim(coalesce(_pincode, '')) !~ '^\d{6}$' THEN
    RAISE EXCEPTION 'Complete delivery address is required';
  END IF;

  DELETE FROM public.customer_addresses
  WHERE storefront_customer_id = _storefront_customer_id;

  RETURN QUERY
  INSERT INTO public.customer_addresses (
    storefront_customer_id, label, full_name, phone,
    street_address, city, state, pincode, is_default
  ) VALUES (
    _storefront_customer_id,
    coalesce(nullif(btrim(_label), ''), 'Home'),
    btrim(_full_name),
    nullif(btrim(_phone), ''),
    btrim(_street_address),
    btrim(_city),
    btrim(_state),
    btrim(_pincode),
    true
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_customer_address(uuid,text,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_customer_address(uuid,text,text,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_customer_address(uuid,text,text,text,text,text,text,text) TO service_role;