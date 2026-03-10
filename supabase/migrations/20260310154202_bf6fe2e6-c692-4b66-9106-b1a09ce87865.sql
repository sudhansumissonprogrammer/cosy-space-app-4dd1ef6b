
CREATE OR REPLACE FUNCTION public.get_storefront_data(_slug text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store stores%ROWTYPE;
  _products json;
  _categories json;
BEGIN
  SELECT * INTO _store FROM stores WHERE slug = _slug LIMIT 1;
  IF _store.id IS NULL THEN
    RETURN json_build_object('store', null, 'products', '[]'::json, 'categories', '[]'::json);
  END IF;

  SELECT COALESCE(json_agg(p ORDER BY p.created_at DESC), '[]'::json)
  INTO _products
  FROM products p
  WHERE p.store_id = _store.id AND p.is_active = true;

  SELECT COALESCE(json_agg(c ORDER BY c.name), '[]'::json)
  INTO _categories
  FROM categories c
  WHERE c.store_id = _store.id;

  RETURN json_build_object(
    'store', row_to_json(_store),
    'products', _products,
    'categories', _categories
  );
END;
$$;
