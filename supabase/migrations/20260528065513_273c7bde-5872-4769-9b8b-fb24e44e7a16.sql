
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS image_url text;

UPDATE public.order_items oi
SET image_url = p.image_url
FROM public.products p
WHERE oi.product_id = p.id
  AND oi.image_url IS NULL
  AND p.image_url IS NOT NULL;

CREATE OR REPLACE FUNCTION public.order_items_fill_image_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.image_url IS NULL AND NEW.product_id IS NOT NULL THEN
    SELECT image_url INTO NEW.image_url FROM public.products WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_fill_image_url ON public.order_items;
CREATE TRIGGER trg_order_items_fill_image_url
BEFORE INSERT ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.order_items_fill_image_url();
