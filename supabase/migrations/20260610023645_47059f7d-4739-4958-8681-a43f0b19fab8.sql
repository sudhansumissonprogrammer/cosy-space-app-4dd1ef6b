
-- 1. Add column (default false, safe for all existing rows)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_variants boolean NOT NULL DEFAULT false;

-- 2. Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_products_has_variants
  ON public.products (store_id, has_variants)
  WHERE has_variants = true;

-- 3. Backfill from existing active variants
UPDATE public.products p
SET has_variants = true
WHERE EXISTS (
  SELECT 1 FROM public.product_variants v
  WHERE v.product_id = p.id AND v.is_active = true
);

-- 4. Trigger function — recompute flag for affected product(s)
CREATE OR REPLACE FUNCTION public.sync_product_has_variants()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_id uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    affected_id := OLD.product_id;
  ELSE
    affected_id := NEW.product_id;
    IF (TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
      UPDATE public.products
      SET has_variants = EXISTS (
        SELECT 1 FROM public.product_variants
        WHERE product_id = OLD.product_id AND is_active = true
      )
      WHERE id = OLD.product_id;
    END IF;
  END IF;

  UPDATE public.products
  SET has_variants = EXISTS (
    SELECT 1 FROM public.product_variants
    WHERE product_id = affected_id AND is_active = true
  )
  WHERE id = affected_id;

  RETURN NULL;
END;
$$;

-- 5. Trigger on product_variants — runs after every change
DROP TRIGGER IF EXISTS trg_sync_product_has_variants ON public.product_variants;
CREATE TRIGGER trg_sync_product_has_variants
AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_has_variants();
