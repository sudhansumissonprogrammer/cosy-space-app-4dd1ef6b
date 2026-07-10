
-- Audit log for tracking-related columns on stores (pixel + CAPI token)
CREATE TABLE IF NOT EXISTS public.stores_tracking_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  changed_by UUID,
  column_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.stores_tracking_audit TO authenticated;
GRANT ALL ON public.stores_tracking_audit TO service_role;
ALTER TABLE public.stores_tracking_audit ENABLE ROW LEVEL SECURITY;

-- Only the store owner (or an admin) can read their store's tracking audit
CREATE POLICY "Store owner can read tracking audit"
ON public.stores_tracking_audit FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = stores_tracking_audit.store_id
      AND s.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

CREATE INDEX IF NOT EXISTS idx_stores_tracking_audit_store ON public.stores_tracking_audit(store_id, changed_at DESC);

-- Trigger function: logs any change to facebook_pixel_id or meta_access_token
CREATE OR REPLACE FUNCTION public.log_stores_tracking_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.facebook_pixel_id IS DISTINCT FROM OLD.facebook_pixel_id THEN
    INSERT INTO public.stores_tracking_audit(store_id, changed_by, column_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'facebook_pixel_id', OLD.facebook_pixel_id, NEW.facebook_pixel_id);
  END IF;
  IF NEW.meta_access_token IS DISTINCT FROM OLD.meta_access_token THEN
    INSERT INTO public.stores_tracking_audit(store_id, changed_by, column_name, old_value, new_value)
    VALUES (NEW.id, auth.uid(), 'meta_access_token', OLD.meta_access_token, NEW.meta_access_token);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_stores_tracking_change ON public.stores;
CREATE TRIGGER trg_log_stores_tracking_change
AFTER UPDATE OF facebook_pixel_id, meta_access_token ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.log_stores_tracking_change();
