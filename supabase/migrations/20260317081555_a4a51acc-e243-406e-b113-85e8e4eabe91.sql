
CREATE OR REPLACE FUNCTION public.check_product_limit(_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _plan_name text;
  _product_limit integer;
  _current_count integer;
  _store_id uuid;
  _is_free_lifetime boolean;
  _custom_product_limit integer;
  _custom_plan_name text;
  _plan_name_base text;
  _plan_product_limit integer;
  _found boolean := false;
BEGIN
  -- Get the user's store
  SELECT id INTO _store_id
  FROM public.stores
  WHERE owner_id = _user_id
  LIMIT 1;

  -- Check store_plan_assignments first (admin overrides)
  IF _store_id IS NOT NULL THEN
    SELECT 
      spa.is_free_lifetime,
      spa.custom_product_limit,
      spa.custom_plan_name,
      p.name,
      p.product_limit
    INTO 
      _is_free_lifetime,
      _custom_product_limit,
      _custom_plan_name,
      _plan_name_base,
      _plan_product_limit
    FROM public.store_plan_assignments spa
    JOIN public.plans p ON p.id = spa.plan_id
    WHERE spa.store_id = _store_id AND spa.status = 'active'
    LIMIT 1;

    IF FOUND THEN
      _found := true;
      _plan_name := COALESCE(_custom_plan_name, _plan_name_base);
      
      IF _is_free_lifetime THEN
        _product_limit := NULL; -- unlimited
      ELSE
        _product_limit := COALESCE(_custom_product_limit, _plan_product_limit);
      END IF;
    END IF;
  END IF;

  -- Fallback to subscriptions table if no store_plan_assignment found
  IF NOT _found THEN
    SELECT p.name, p.product_limit INTO _plan_name, _product_limit
    FROM public.subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.user_id = _user_id AND s.status = 'active'
    LIMIT 1;
  END IF;

  -- Final fallback
  IF _plan_name IS NULL THEN
    _plan_name := 'Free';
    _product_limit := 10;
  END IF;

  SELECT COUNT(*) INTO _current_count
  FROM public.products prod
  JOIN public.stores st ON st.id = prod.store_id
  WHERE st.owner_id = _user_id;

  RETURN json_build_object(
    'plan_name', _plan_name,
    'product_limit', _product_limit,
    'current_count', _current_count,
    'can_create', (_product_limit IS NULL OR _current_count < _product_limit)
  );
END;
$function$;
