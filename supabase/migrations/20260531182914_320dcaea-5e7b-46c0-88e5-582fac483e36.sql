-- 1. Helper function: fills SEO defaults only when missing/too short
CREATE OR REPLACE FUNCTION public.fill_store_seo_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text := COALESCE(NULLIF(trim(NEW.name), ''), 'Online Store');
  v_desc text := COALESCE(NULLIF(trim(NEW.description), ''), '');
  v_built text;
BEGIN
  -- meta_title: target ~50-60 chars
  IF NEW.meta_title IS NULL OR length(trim(NEW.meta_title)) < 30 THEN
    NEW.meta_title := left(
      v_name || ' — Shop Online | Best Prices & Fast Delivery in India',
      60
    );
  END IF;

  -- meta_description: target ~140-160 chars
  IF NEW.meta_description IS NULL OR length(trim(NEW.meta_description)) < 120 THEN
    v_built := v_name || ' — '
      || COALESCE(NULLIF(v_desc, ''), 'shop trending products online')
      || '. Secure payments, fast all-India delivery, easy returns & friendly customer support.';
    NEW.meta_description := left(v_built, 160);
  END IF;

  -- og_image_url falls back to banner_url when missing
  IF NEW.og_image_url IS NULL AND NEW.banner_url IS NOT NULL THEN
    NEW.og_image_url := NEW.banner_url;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Trigger: runs on insert and on relevant updates
DROP TRIGGER IF EXISTS trg_fill_store_seo_defaults ON public.stores;
CREATE TRIGGER trg_fill_store_seo_defaults
BEFORE INSERT OR UPDATE OF name, description, meta_title, meta_description, banner_url, og_image_url
ON public.stores
FOR EACH ROW
EXECUTE FUNCTION public.fill_store_seo_defaults();

-- 3. Backfill existing stores: nulling weak values lets the trigger recompute them
UPDATE public.stores
SET
  meta_title = CASE
    WHEN meta_title IS NULL OR length(trim(meta_title)) < 30 THEN NULL
    ELSE meta_title
  END,
  meta_description = CASE
    WHEN meta_description IS NULL OR length(trim(meta_description)) < 120 THEN NULL
    ELSE meta_description
  END
WHERE
  meta_title IS NULL OR length(trim(meta_title)) < 30
  OR meta_description IS NULL OR length(trim(meta_description)) < 120
  OR (og_image_url IS NULL AND banner_url IS NOT NULL);