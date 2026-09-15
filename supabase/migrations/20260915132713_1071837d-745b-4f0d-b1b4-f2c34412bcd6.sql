CREATE OR REPLACE FUNCTION public.enforce_review_not_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.is_verified := false;
  NEW.pinned_rank := NULL;
  IF public.is_store_owner(NEW.store_id)
     OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    NEW.approval_status := 'approved';
    NEW.is_hidden := false;
  ELSE
    NEW.approval_status := 'pending';
    NEW.is_hidden := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_review_not_verified() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_review_not_verified() TO service_role;