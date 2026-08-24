ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.products  ADD COLUMN IF NOT EXISTS hidden_by_category boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_store_visible
  ON public.products (store_id) WHERE is_active AND NOT hidden_by_category;

CREATE OR REPLACE FUNCTION public.calc_hidden_by_category(_store_id uuid, _product_id uuid, _category text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
      SELECT 1 FROM product_categories pc
      JOIN categories c ON c.id = pc.category_id
      WHERE pc.product_id = _product_id AND c.is_hidden
    )
    OR EXISTS (
      SELECT 1 FROM categories c
      WHERE c.store_id = _store_id AND c.is_hidden
        AND _category IS NOT NULL AND lower(c.name) = lower(_category)
    );
$$;

CREATE OR REPLACE FUNCTION public.products_sync_hidden()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  NEW.hidden_by_category := public.calc_hidden_by_category(NEW.store_id, NEW.id, NEW.category);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_sync_hidden ON public.products;
CREATE TRIGGER trg_products_sync_hidden
BEFORE INSERT OR UPDATE OF category, store_id ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_sync_hidden();

CREATE OR REPLACE FUNCTION public.product_categories_sync_hidden()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _pid uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE public.products p
     SET hidden_by_category = public.calc_hidden_by_category(p.store_id, p.id, p.category)
   WHERE p.id = _pid
     AND p.hidden_by_category IS DISTINCT FROM public.calc_hidden_by_category(p.store_id, p.id, p.category);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_pc_sync_hidden ON public.product_categories;
CREATE TRIGGER trg_pc_sync_hidden
AFTER INSERT OR DELETE ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.product_categories_sync_hidden();

CREATE OR REPLACE FUNCTION public.categories_sync_hidden()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  _store uuid := COALESCE(NEW.store_id, OLD.store_id);
  _cat   uuid := COALESCE(NEW.id, OLD.id);
BEGIN
  UPDATE public.products p
     SET hidden_by_category = public.calc_hidden_by_category(p.store_id, p.id, p.category)
   WHERE p.store_id = _store
     AND (
       lower(COALESCE(p.category,'')) = lower(COALESCE(NEW.name,''))
       OR lower(COALESCE(p.category,'')) = lower(COALESCE(OLD.name,''))
       OR EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = p.id AND pc.category_id = _cat)
     )
     AND p.hidden_by_category IS DISTINCT FROM public.calc_hidden_by_category(p.store_id, p.id, p.category);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_categories_sync_hidden ON public.categories;
CREATE TRIGGER trg_categories_sync_hidden
AFTER INSERT OR DELETE OR UPDATE OF is_hidden, name ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.categories_sync_hidden();

DROP POLICY IF EXISTS "Products readable by public, owner or admin" ON public.products;
CREATE POLICY "Products readable by public, owner or admin"
ON public.products FOR SELECT
USING (
  ((is_active = true) AND (hidden_by_category = false))
  OR (store_id IN (SELECT my_store_ids()))
  OR (SELECT is_admin())
);

DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
CREATE POLICY "Public can view categories"
ON public.categories FOR SELECT
USING (
  (is_hidden = false)
  OR (store_id IN (SELECT my_store_ids()))
  OR (SELECT is_admin())
);