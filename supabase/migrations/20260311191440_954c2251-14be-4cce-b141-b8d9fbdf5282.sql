
-- Create store_theme_config table
CREATE TABLE public.store_theme_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  primary_color text NOT NULL DEFAULT '#b8873c',
  accent_color text NOT NULL DEFAULT '#000000',
  text_color text NOT NULL DEFAULT '#1a1a1a',
  background_color text NOT NULL DEFAULT '#f7f5f0',
  heading_font text NOT NULL DEFAULT 'Alegreya SC',
  body_font text NOT NULL DEFAULT 'Inter',
  button_style text NOT NULL DEFAULT 'rounded',
  marquee_gradient text NOT NULL DEFAULT 'linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a)',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id)
);

-- Enable RLS
ALTER TABLE public.store_theme_config ENABLE ROW LEVEL SECURITY;

-- Store owners can CRUD their own config
CREATE POLICY "Store owners can manage theme config"
  ON public.store_theme_config FOR ALL
  TO authenticated
  USING (is_store_owner(store_id) AND NOT is_user_blocked())
  WITH CHECK (is_store_owner(store_id) AND NOT is_user_blocked());

-- Public can read (storefront needs it)
CREATE POLICY "Public can view theme config"
  ON public.store_theme_config FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Authenticated can view theme config"
  ON public.store_theme_config FOR SELECT
  TO authenticated
  USING (true);

-- Auto-update updated_at
CREATE TRIGGER update_store_theme_config_updated_at
  BEFORE UPDATE ON public.store_theme_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update get_storefront_data RPC to include theme config
CREATE OR REPLACE FUNCTION public.get_storefront_data(_slug text)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store stores%ROWTYPE;
  _products json;
  _categories json;
  _theme_config json;
BEGIN
  SELECT * INTO _store FROM stores WHERE slug = _slug LIMIT 1;
  IF _store.id IS NULL THEN
    RETURN json_build_object('store', null, 'products', '[]'::json, 'categories', '[]'::json, 'theme_config', null);
  END IF;

  SELECT COALESCE(json_agg(p ORDER BY p.created_at DESC), '[]'::json)
  INTO _products
  FROM products p
  WHERE p.store_id = _store.id AND p.is_active = true;

  SELECT COALESCE(json_agg(c ORDER BY c.name), '[]'::json)
  INTO _categories
  FROM categories c
  WHERE c.store_id = _store.id;

  SELECT row_to_json(tc) INTO _theme_config
  FROM store_theme_config tc
  WHERE tc.store_id = _store.id;

  RETURN json_build_object(
    'store', row_to_json(_store),
    'products', _products,
    'categories', _categories,
    'theme_config', _theme_config
  );
END;
$function$;
