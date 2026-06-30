-- Commission-only cleanup: remove runtime dependency on deleted plan/subscription tables.
CREATE OR REPLACE FUNCTION public.check_product_limit(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _current_count integer;
BEGIN
  SELECT COUNT(*) INTO _current_count
  FROM public.products prod
  JOIN public.stores st ON st.id = prod.store_id
  WHERE st.owner_id = _user_id;

  RETURN json_build_object(
    'plan_name', 'Commission',
    'product_limit', NULL,
    'current_count', _current_count,
    'can_create', true
  );
END;
$function$;
