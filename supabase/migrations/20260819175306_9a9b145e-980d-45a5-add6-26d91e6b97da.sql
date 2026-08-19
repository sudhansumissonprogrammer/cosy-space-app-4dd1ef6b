-- 1. Link table
CREATE TABLE IF NOT EXISTS public.product_categories (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (product_id, category_id)
);

GRANT SELECT ON public.product_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view product categories"
  ON public.product_categories FOR SELECT USING (true);

CREATE POLICY "Store owners can manage product categories"
  ON public.product_categories FOR ALL TO authenticated
  USING (is_store_owner(store_id) AND (NOT is_user_blocked()))
  WITH CHECK (is_store_owner(store_id) AND (NOT is_user_blocked()));

CREATE POLICY "Admins can manage product categories"
  ON public.product_categories FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_product_categories_category ON public.product_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_product_categories_store ON public.product_categories(store_id);

-- 2. Backfill from existing products.category text
INSERT INTO public.product_categories (product_id, category_id, store_id, is_primary)
SELECT p.id, c.id, p.store_id, true
FROM public.products p
JOIN public.categories c
  ON c.store_id = p.store_id AND lower(c.name) = lower(p.category)
WHERE p.category IS NOT NULL AND p.category <> ''
ON CONFLICT (product_id, category_id) DO NOTHING;

-- 3. Keep primary link in sync when products.category changes
CREATE OR REPLACE FUNCTION public.sync_primary_product_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cat_id uuid;
BEGIN
  UPDATE public.product_categories SET is_primary = false
   WHERE product_id = NEW.id AND is_primary = true;

  IF NEW.category IS NOT NULL AND NEW.category <> '' THEN
    SELECT id INTO _cat_id FROM public.categories
     WHERE store_id = NEW.store_id AND lower(name) = lower(NEW.category)
     LIMIT 1;
    IF _cat_id IS NOT NULL THEN
      INSERT INTO public.product_categories (product_id, category_id, store_id, is_primary)
      VALUES (NEW.id, _cat_id, NEW.store_id, true)
      ON CONFLICT (product_id, category_id)
      DO UPDATE SET is_primary = true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_primary_product_category ON public.products;
CREATE TRIGGER trg_sync_primary_product_category
AFTER INSERT OR UPDATE OF category ON public.products
FOR EACH ROW EXECUTE FUNCTION public.sync_primary_product_category();

-- 4. Category page includes linked products
CREATE OR REPLACE FUNCTION public.get_category_page(_store_slug text, _category_slug text, _limit integer DEFAULT 24)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _store_id uuid;
  _category json;
  _category_id uuid;
  _category_name text;
  _products json;
  _total int;
BEGIN
  SELECT id INTO _store_id FROM stores WHERE slug = _store_slug AND is_suspended = false LIMIT 1;
  IF _store_id IS NULL THEN
    RETURN json_build_object('category', null, 'products', '[]'::json, 'total', 0);
  END IF;

  SELECT row_to_json(c), c.name, c.id INTO _category, _category_name, _category_id FROM (
    SELECT id, store_id, name, slug, image_url, display_order, show_on_home, created_at,
           meta_title, meta_description, og_image_url
    FROM categories
    WHERE store_id = _store_id AND slug = _category_slug
    LIMIT 1
  ) c;
  IF _category IS NULL THEN
    RETURN json_build_object('category', null, 'products', '[]'::json, 'total', 0);
  END IF;

  SELECT COUNT(*) INTO _total FROM products p
  WHERE p.store_id = _store_id AND p.is_active = true
    AND (p.category = _category_name
         OR EXISTS (SELECT 1 FROM product_categories pc
                     WHERE pc.product_id = p.id AND pc.category_id = _category_id));

  SELECT COALESCE(json_agg(p ORDER BY p.is_category_pinned DESC, p.category_pinned_at DESC NULLS LAST, p.display_order ASC, p.created_at DESC), '[]'::json) INTO _products FROM (
    SELECT id, store_id, name, description, price, currency, sku, stock_quantity,
           is_active, image_url, slug, sale_price, category, is_best_selling,
           is_category_pinned, category_pinned_at,
           display_order, created_at, updated_at
    FROM products pr
    WHERE pr.store_id = _store_id AND pr.is_active = true
      AND (pr.category = _category_name
           OR EXISTS (SELECT 1 FROM product_categories pc
                       WHERE pc.product_id = pr.id AND pc.category_id = _category_id))
    ORDER BY is_category_pinned DESC, category_pinned_at DESC NULLS LAST, display_order ASC, created_at DESC
    LIMIT GREATEST(_limit, 1)
  ) p;

  RETURN json_build_object('category', _category, 'products', _products, 'total', _total);
END;
$function$;

-- 5. Paged category products (used by infinite scroll)
DROP FUNCTION IF EXISTS public.get_category_products_page(uuid, text, integer, integer);
CREATE OR REPLACE FUNCTION public.get_category_products_page(
  _store_id uuid, _category_name text, _offset integer DEFAULT 0, _limit integer DEFAULT 24
)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _category_id uuid;
  _rows json;
BEGIN
  SELECT id INTO _category_id FROM categories
   WHERE store_id = _store_id AND lower(name) = lower(_category_name) LIMIT 1;

  SELECT COALESCE(json_agg(p ORDER BY p.is_category_pinned DESC, p.category_pinned_at DESC NULLS LAST, p.display_order ASC, p.created_at DESC), '[]'::json)
    INTO _rows FROM (
    SELECT id, store_id, name, description, price, currency, sku, stock_quantity,
           is_active, image_url, slug, sale_price, category, is_best_selling,
           is_category_pinned, category_pinned_at, video_url, video_poster_url,
           display_order, created_at, updated_at
    FROM products pr
    WHERE pr.store_id = _store_id AND pr.is_active = true
      AND (lower(pr.category) = lower(_category_name)
           OR (_category_id IS NOT NULL AND EXISTS (
                 SELECT 1 FROM product_categories pc
                  WHERE pc.product_id = pr.id AND pc.category_id = _category_id)))
    ORDER BY is_category_pinned DESC, category_pinned_at DESC NULLS LAST, display_order ASC, created_at DESC
    OFFSET GREATEST(_offset, 0) LIMIT GREATEST(_limit, 1)
  ) p;

  RETURN _rows;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_category_products_page(uuid, text, integer, integer) TO anon, authenticated, service_role;