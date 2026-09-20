CREATE TABLE public.category_featured_products (
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position BETWEEN 1 AND 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (category_id, position),
  UNIQUE (category_id, product_id)
);

GRANT SELECT ON public.category_featured_products TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.category_featured_products TO authenticated;
GRANT ALL ON public.category_featured_products TO service_role;

ALTER TABLE public.category_featured_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view category featured products"
ON public.category_featured_products FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Store owners can add category featured products"
ON public.category_featured_products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id AND public.is_store_owner(c.store_id)
  )
);

CREATE POLICY "Store owners can update category featured products"
ON public.category_featured_products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id AND public.is_store_owner(c.store_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id AND public.is_store_owner(c.store_id)
  )
);

CREATE POLICY "Store owners can remove category featured products"
ON public.category_featured_products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id AND public.is_store_owner(c.store_id)
  )
);

CREATE OR REPLACE FUNCTION public.validate_category_featured_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  _category public.categories%ROWTYPE;
  _product public.products%ROWTYPE;
BEGIN
  SELECT * INTO _category FROM public.categories WHERE id = NEW.category_id;
  SELECT * INTO _product FROM public.products WHERE id = NEW.product_id;

  IF _category.id IS NULL OR _product.id IS NULL THEN
    RAISE EXCEPTION 'Category or product not found';
  END IF;
  IF _category.store_id <> _product.store_id THEN
    RAISE EXCEPTION 'Featured product must belong to the same store';
  END IF;
  IF lower(trim(COALESCE(_product.category, ''))) <> lower(trim(_category.name)) THEN
    RAISE EXCEPTION 'Featured product must belong to this category';
  END IF;
  IF NOT _product.is_active OR COALESCE(_product.hidden_by_category, false) THEN
    RAISE EXCEPTION 'Featured product must be active and visible';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_category_featured_product_before_write
BEFORE INSERT OR UPDATE ON public.category_featured_products
FOR EACH ROW EXECUTE FUNCTION public.validate_category_featured_product();

CREATE INDEX category_featured_products_product_idx
ON public.category_featured_products(product_id);

CREATE OR REPLACE FUNCTION public.get_category_collage_urls(_category_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH category_row AS (
    SELECT c.id, c.store_id, c.name
    FROM public.categories c
    WHERE c.id = _category_id
  ),
  selected AS (
    SELECT p.id, p.image_url, cfp.position::bigint AS rank
    FROM public.category_featured_products cfp
    JOIN category_row c ON c.id = cfp.category_id
    JOIN public.products p ON p.id = cfp.product_id
      AND p.store_id = c.store_id
      AND lower(trim(COALESCE(p.category, ''))) = lower(trim(c.name))
      AND p.is_active = true
      AND COALESCE(p.hidden_by_category, false) = false
    WHERE NULLIF(trim(COALESCE(p.image_url, '')), '') IS NOT NULL
  ),
  automatic AS (
    SELECT p.id, p.image_url,
      (4 + row_number() OVER (ORDER BY p.is_category_pinned DESC NULLS LAST, p.category_pinned_at DESC NULLS LAST, p.display_order, p.created_at DESC, p.id))::bigint AS rank
    FROM category_row c
    JOIN public.products p ON p.store_id = c.store_id
      AND lower(trim(COALESCE(p.category, ''))) = lower(trim(c.name))
      AND p.is_active = true
      AND COALESCE(p.hidden_by_category, false) = false
      AND NULLIF(trim(COALESCE(p.image_url, '')), '') IS NOT NULL
    WHERE NOT EXISTS (
      SELECT 1 FROM public.category_featured_products cfp
      WHERE cfp.category_id = c.id AND cfp.product_id = p.id
    )
  ),
  resolved AS (
    SELECT id, image_url, rank FROM selected
    UNION ALL
    SELECT id, image_url, rank FROM automatic
  )
  SELECT COALESCE(jsonb_agg(image_url ORDER BY rank), '[]'::jsonb)
  FROM (SELECT image_url, rank FROM resolved ORDER BY rank LIMIT 4) four;
$$;

REVOKE ALL ON FUNCTION public.get_category_collage_urls(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_category_collage_urls(uuid) TO anon, authenticated, service_role;

DROP FUNCTION IF EXISTS public.get_storefront_shell(text, boolean);

CREATE FUNCTION public.get_storefront_shell(_slug text, _with_pages boolean DEFAULT true)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _store stores%ROWTYPE;
  _categories json;
  _theme_config json;
  _shipping_config json;
  _custom_pages json;
  _standard_pages json;
  _store_json jsonb;
  _total_products bigint;
  _meta_capi_enabled boolean;
  _products_preview json;
BEGIN
  SELECT * INTO _store FROM stores WHERE slug = _slug LIMIT 1;
  IF _store.id IS NULL THEN
    RETURN json_build_object('store', null, 'categories', '[]'::json, 'theme_config', null, 'shipping_config', null, 'custom_pages', '[]'::json, 'standard_pages', '[]'::json, 'total_products', 0, 'meta_capi_enabled', false, 'products_preview', '[]'::json);
  END IF;

  IF COALESCE(_store.is_suspended, false) THEN
    RETURN json_build_object('store', null, 'categories', '[]'::json, 'theme_config', null, 'shipping_config', null, 'custom_pages', '[]'::json, 'standard_pages', '[]'::json, 'total_products', 0, 'meta_capi_enabled', false, 'products_preview', '[]'::json);
  END IF;

  _meta_capi_enabled := (
    _store.meta_access_token IS NOT NULL
    AND length(trim(_store.meta_access_token)) > 0
    AND COALESCE(_store.capi_disabled, false) = false
  );

  SELECT COUNT(*) INTO _total_products FROM products
   WHERE store_id = _store.id AND is_active = true AND hidden_by_category = false;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(c) || jsonb_build_object('collage_image_urls', public.get_category_collage_urls(c.id)) ORDER BY c.display_order, c.name),
    '[]'::jsonb
  )::json INTO _categories
  FROM categories c WHERE c.store_id = _store.id AND c.is_hidden = false;

  SELECT row_to_json(tc) INTO _theme_config
  FROM store_theme_config tc WHERE tc.store_id = _store.id;

  SELECT json_build_object(
    'free_shipping_above', sc.free_shipping_above,
    'flat_rate', sc.flat_rate,
    'is_active', sc.is_active
  ) INTO _shipping_config
  FROM store_shipping_config sc WHERE sc.store_id = _store.id;

  IF _with_pages THEN
    SELECT COALESCE(
      json_agg(json_build_object('id', sp.id, 'title', sp.title, 'slug', sp.slug, 'content', sp.content, 'image_url', sp.image_url) ORDER BY sp.display_order),
      '[]'::json
    ) INTO _custom_pages
    FROM store_pages sp
    WHERE sp.store_id = _store.id AND sp.page_type = 'custom' AND sp.is_active = true;

    SELECT COALESCE(
      json_agg(json_build_object('id', sp.id, 'page_type', sp.page_type, 'title', sp.title, 'slug', sp.slug, 'content', sp.content, 'custom_html', sp.custom_html, 'image_url', sp.image_url) ORDER BY sp.display_order),
      '[]'::json
    ) INTO _standard_pages
    FROM store_pages sp
    WHERE sp.store_id = _store.id AND sp.page_type IN ('about', 'about_us', 'contact') AND sp.is_active = true;
  ELSE
    _custom_pages := '[]'::json;
    _standard_pages := '[]'::json;
  END IF;

  SELECT COALESCE(
    json_agg(json_build_object(
      'id', p.id, 'category', p.category, 'currency', p.currency, 'description', p.description,
      'image_url', p.image_url, 'is_active', p.is_active, 'is_best_selling', p.is_best_selling,
      'name', p.name, 'price', p.price, 'sale_price', p.sale_price, 'slug', p.slug,
      'stock_quantity', p.stock_quantity, 'store_id', p.store_id, 'video_url', p.video_url,
      'video_poster_url', p.video_poster_url
    ) ORDER BY p.is_best_selling DESC NULLS LAST, p.created_at DESC, p.id ASC),
    '[]'::json
  ) INTO _products_preview
  FROM (
    SELECT * FROM products
    WHERE store_id = _store.id AND is_active = true AND hidden_by_category = false
    ORDER BY is_best_selling DESC NULLS LAST, created_at DESC, id ASC LIMIT 20
  ) p;

  _store_json := to_jsonb(_store)
    - 'meta_access_token' - 'owner_email' - 'domain_verification_token'
    - 'suspension_reason' - 'referred_by_partner_id' - 'default_profit_margin';

  RETURN json_build_object(
    'store', _store_json, 'categories', COALESCE(_categories, '[]'::json),
    'theme_config', _theme_config, 'shipping_config', _shipping_config,
    'custom_pages', COALESCE(_custom_pages, '[]'::json),
    'standard_pages', COALESCE(_standard_pages, '[]'::json),
    'total_products', COALESCE(_total_products, 0), 'meta_capi_enabled', _meta_capi_enabled,
    'products_preview', COALESCE(_products_preview, '[]'::json)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_storefront_shell(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_shell(text, boolean) TO anon, authenticated, service_role;