CREATE OR REPLACE FUNCTION public.lock_shipment_awb(_store_id uuid, _awb text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _store_id IS NULL OR nullif(btrim(_awb), '') IS NULL THEN
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_store_id::text || ':' || upper(btrim(_awb)), 0));
END;
$$;
REVOKE ALL ON FUNCTION public.lock_shipment_awb(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lock_shipment_awb(uuid, text) TO service_role;