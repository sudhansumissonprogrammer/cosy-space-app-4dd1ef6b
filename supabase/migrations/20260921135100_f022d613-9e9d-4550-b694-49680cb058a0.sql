CREATE OR REPLACE FUNCTION public.move_category_order(_id uuid, _direction text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _store_id uuid;
  _pos int;
  _target_id uuid;
  _target_pos int;
BEGIN
  IF _direction NOT IN ('up','down') THEN
    RAISE EXCEPTION 'invalid direction';
  END IF;

  SELECT store_id INTO _store_id
  FROM public.categories
  WHERE id = _id;

  IF _store_id IS NULL THEN
    RAISE EXCEPTION 'category not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.stores
    WHERE id = _store_id
      AND owner_id = auth.uid()
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  WITH ranked AS (
    SELECT id, (row_number() OVER (ORDER BY display_order NULLS LAST, name, id))::int AS rn
    FROM public.categories
    WHERE store_id = _store_id
  )
  UPDATE public.categories c
  SET display_order = r.rn
  FROM ranked r
  WHERE c.id = r.id
    AND c.display_order IS DISTINCT FROM r.rn;

  SELECT display_order INTO _pos
  FROM public.categories
  WHERE id = _id;

  IF _direction = 'up' THEN
    SELECT id, display_order INTO _target_id, _target_pos
    FROM public.categories
    WHERE store_id = _store_id
      AND display_order < _pos
    ORDER BY display_order DESC, name, id
    LIMIT 1;
  ELSE
    SELECT id, display_order INTO _target_id, _target_pos
    FROM public.categories
    WHERE store_id = _store_id
      AND display_order > _pos
    ORDER BY display_order ASC, name, id
    LIMIT 1;
  END IF;

  IF _target_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.categories SET display_order = _pos WHERE id = _target_id;
  UPDATE public.categories SET display_order = _target_pos WHERE id = _id;
END;
$function$;

REVOKE ALL ON FUNCTION public.move_category_order(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_category_order(uuid, text) TO authenticated, service_role;