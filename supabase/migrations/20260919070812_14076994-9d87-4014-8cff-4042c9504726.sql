REVOKE ALL ON FUNCTION public.guard_active_shipment_awb() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guard_active_shipment_awb() TO service_role;