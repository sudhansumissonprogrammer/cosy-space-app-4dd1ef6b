CREATE OR REPLACE FUNCTION public.get_store_as_admin(_slug text)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _store stores%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Try slug first, then try as UUID
  SELECT * INTO _store FROM stores WHERE slug = _slug LIMIT 1;
  
  IF _store.id IS NULL THEN
    BEGIN
      SELECT * INTO _store FROM stores WHERE id = _slug::uuid LIMIT 1;
    EXCEPTION WHEN invalid_text_representation THEN
      NULL; -- not a valid UUID, ignore
    END;
  END IF;

  IF _store.id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN row_to_json(_store);
END;
$$;