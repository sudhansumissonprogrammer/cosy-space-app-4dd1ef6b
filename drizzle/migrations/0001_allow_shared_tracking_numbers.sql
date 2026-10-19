CREATE OR REPLACE FUNCTION public.guard_active_shipment_awb()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN RETURN NEW; END; $$;
COMMENT ON FUNCTION public.guard_active_shipment_awb() IS 'DEPRECATED: tracking numbers may be shared across orders; no-op.';
DROP INDEX IF EXISTS public.parcel_label_scans_accepted_awb_unique;