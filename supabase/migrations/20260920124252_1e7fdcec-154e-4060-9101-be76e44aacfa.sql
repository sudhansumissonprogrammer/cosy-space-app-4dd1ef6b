CREATE OR REPLACE FUNCTION public.set_category_featured_products(_category_id uuid, _product_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _category public.categories%ROWTYPE;
  _product_id uuid;
  _position integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO _category FROM public.categories WHERE id = _category_id;
  IF _category.id IS NULL OR NOT public.is_store_owner(_category.store_id) THEN
    RAISE EXCEPTION 'Category not found or access denied';
  END IF;

  IF COALESCE(array_length(_product_ids, 1), 0) > 4 THEN
    RAISE EXCEPTION 'Choose at most four products';
  END IF;

  IF COALESCE(array_length(_product_ids, 1), 0) <> COALESCE((SELECT count(DISTINCT x) FROM unnest(_product_ids) x), 0) THEN
    RAISE EXCEPTION 'Products must be unique';
  END IF;

  FOR _position IN 1..COALESCE(array_length(_product_ids, 1), 0) LOOP
    _product_id := _product_ids[_position];
    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = _product_id
        AND p.store_id = _category.store_id
        AND lower(trim(COALESCE(p.category, ''))) = lower(trim(_category.name))
        AND p.is_active = true
        AND COALESCE(p.hidden_by_category, false) = false
    ) THEN
      RAISE EXCEPTION 'A selected product is not eligible for this category';
    END IF;
  END LOOP;

  DELETE FROM public.category_featured_products WHERE category_id = _category_id;
  FOR _position IN 1..COALESCE(array_length(_product_ids, 1), 0) LOOP
    INSERT INTO public.category_featured_products(category_id, product_id, position)
    VALUES (_category_id, _product_ids[_position], _position);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.set_category_featured_products(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_category_featured_products(uuid, uuid[]) TO authenticated, service_role;