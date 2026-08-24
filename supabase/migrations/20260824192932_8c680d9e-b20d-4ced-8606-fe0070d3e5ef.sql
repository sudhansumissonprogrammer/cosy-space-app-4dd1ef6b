CREATE OR REPLACE FUNCTION public.get_category_page(_store_slug text, _category_slug text, _limit integer DEFAULT 24)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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
    WHERE store_id = _store_id AND slug = _category_slug AND is_hidden = false
    LIMIT 1
  ) c;
  IF _category IS NULL THEN
    RETURN json_build_object('category', null, 'products', '[]'::json, 'total', 0);
  END IF;

  SELECT COUNT(*) INTO _total FROM products p
  WHERE p.store_id = _store_id AND p.is_active = true AND p.hidden_by_category = false
    AND (p.category = _category_name
         OR EXISTS (SELECT 1 FROM product_categories pc
                     WHERE pc.product_id = p.id AND pc.category_id = _category_id));

  SELECT COALESCE(json_agg(p ORDER BY p.is_category_pinned DESC, p.category_pinned_at DESC NULLS LAST, p.display_order ASC, p.created_at DESC), '[]'::json) INTO _products FROM (
    SELECT id, store_id, name, description, price, currency, sku, stock_quantity,
           is_active, image_url, slug, sale_price, category, is_best_selling,
           is_category_pinned, category_pinned_at,
           display_order, created_at, updated_at
    FROM products pr
    WHERE pr.store_id = _store_id AND pr.is_active = true AND pr.hidden_by_category = false
      AND (pr.category = _category_name
           OR EXISTS (SELECT 1 FROM product_categories pc
                       WHERE pc.product_id = pr.id AND pc.category_id = _category_id))
    ORDER BY is_category_pinned DESC, category_pinned_at DESC NULLS LAST, display_order ASC, created_at DESC
    LIMIT GREATEST(_limit, 1)
  ) p;

  RETURN json_build_object('category', _category, 'products', _products, 'total', _total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_category_products_page(_store_id uuid, _category_name text, _offset integer DEFAULT 0, _limit integer DEFAULT 24)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _category_id uuid;
  _rows json;
BEGIN
  SELECT id INTO _category_id FROM categories
   WHERE store_id = _store_id AND lower(name) = lower(_category_name) AND is_hidden = false LIMIT 1;

  SELECT COALESCE(json_agg(p ORDER BY p.is_category_pinned DESC, p.category_pinned_at DESC NULLS LAST, p.display_order ASC, p.created_at DESC), '[]'::json)
    INTO _rows FROM (
    SELECT id, store_id, name, description, price, currency, sku, stock_quantity,
           is_active, image_url, slug, sale_price, category, is_best_selling,
           is_category_pinned, category_pinned_at, video_url, video_poster_url,
           display_order, created_at, updated_at
    FROM products pr
    WHERE pr.store_id = _store_id AND pr.is_active = true AND pr.hidden_by_category = false
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

CREATE OR REPLACE FUNCTION public.get_product_page(_store_slug text, _product_slug text)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _store_id uuid;
  _product json;
  _images json;
  _variants json;
  _shipping json;
BEGIN
  SELECT id INTO _store_id FROM stores WHERE slug = _store_slug AND is_suspended = false LIMIT 1;
  IF _store_id IS NULL THEN RETURN json_build_object('product', null); END IF;

  SELECT row_to_json(p) INTO _product FROM (
    SELECT id, store_id, name, description, price, currency, sku, stock_quantity,
           is_active, image_url, slug, sale_price, category, is_best_selling,
           cost_price, display_order, partial_payment_enabled,
           partial_payment_type, partial_payment_value, created_at, updated_at,
           meta_title, meta_description, og_image_url,
           video_url, video_poster_url
    FROM products
    WHERE store_id = _store_id AND slug = _product_slug AND is_active = true
      AND hidden_by_category = false
    LIMIT 1
  ) p;
  IF _product IS NULL THEN RETURN json_build_object('product', null); END IF;

  SELECT COALESCE(json_agg(i ORDER BY i.display_order), '[]'::json) INTO _images FROM (
    SELECT pi.id, pi.product_id, pi.image_url, pi.display_order
    FROM product_images pi
    WHERE pi.product_id = (_product->>'id')::uuid
    ORDER BY pi.display_order
  ) i;

  SELECT COALESCE(json_agg(v ORDER BY v.display_order), '[]'::json) INTO _variants FROM (
    SELECT pv.id, pv.product_id, pv.name, pv.sku, pv.price, pv.stock_quantity,
           pv.is_active, pv.display_order
    FROM product_variants pv
    WHERE pv.product_id = (_product->>'id')::uuid AND pv.is_active = true
    ORDER BY pv.display_order
  ) v;

  SELECT json_build_object(
    'free_shipping_above', sc.free_shipping_above,
    'flat_rate', sc.flat_rate,
    'is_active', sc.is_active
  ) INTO _shipping FROM store_shipping_config sc WHERE sc.store_id = _store_id LIMIT 1;

  RETURN json_build_object(
    'product', _product,
    'images', _images,
    'variants', _variants,
    'shipping_config', _shipping
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_storefront_products_page(_slug text, _category text DEFAULT NULL::text, _sort text DEFAULT 'default'::text, _page integer DEFAULT 0, _limit integer DEFAULT 20)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _store_id uuid;
  _offset integer;
  _fetch integer;
  _rows json;
  _row_count integer;
  _has_more boolean;
BEGIN
  IF _limit IS NULL OR _limit < 1 THEN _limit := 20; END IF;
  IF _limit > 100 THEN _limit := 100; END IF;
  IF _page IS NULL OR _page < 0 THEN _page := 0; END IF;
  _offset := _page * _limit;
  _fetch := _limit + 1;

  SELECT id INTO _store_id FROM public.stores
   WHERE slug = _slug AND COALESCE(is_suspended,false) = false
   LIMIT 1;
  IF _store_id IS NULL THEN
    RETURN json_build_object('products', '[]'::json, 'has_more', false);
  END IF;

  WITH base AS (
    SELECT id, category, created_at, currency, description, image_url,
           is_active, is_best_selling, is_category_pinned, category_pinned_at,
           name, price, sale_price, sku, slug, stock_quantity, store_id,
           updated_at, display_order
    FROM public.products
    WHERE store_id = _store_id
      AND is_active = true
      AND hidden_by_category = false
      AND (_category IS NULL OR category = _category)
    ORDER BY
      CASE WHEN _category IS NOT NULL AND is_category_pinned THEN 0 ELSE 1 END,
      CASE WHEN _category IS NOT NULL THEN category_pinned_at END DESC NULLS LAST,
      CASE WHEN _sort = 'price-asc'  THEN COALESCE(sale_price, price) END ASC,
      CASE WHEN _sort = 'price-desc' THEN COALESCE(sale_price, price) END DESC,
      CASE WHEN _sort = 'newest'     THEN created_at END DESC,
      display_order ASC,
      created_at DESC,
      id ASC
    LIMIT _fetch
    OFFSET _offset
  )
  SELECT COALESCE(json_agg(to_jsonb(b) - 'display_order'), '[]'::json), count(*)
    INTO _rows, _row_count
  FROM base b;

  _has_more := _row_count > _limit;

  IF _has_more THEN
    SELECT json_agg(elem) INTO _rows
    FROM (
      SELECT elem FROM json_array_elements(_rows) WITH ORDINALITY t(elem, ord)
      WHERE ord <= _limit
    ) s;
  END IF;

  RETURN json_build_object('products', COALESCE(_rows, '[]'::json), 'has_more', _has_more);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_storefront_seo(_slug text)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _store stores%ROWTYPE;
  _categories json;
  _products json;
BEGIN
  SELECT * INTO _store FROM stores WHERE slug = _slug LIMIT 1;
  IF _store.id IS NULL OR COALESCE(_store.is_suspended, false) THEN
    RETURN json_build_object('store', null);
  END IF;

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'name', c.name,
        'slug', c.slug,
        'image_url', c.image_url,
        'product_count', (
          SELECT count(*) FROM products p
          WHERE p.store_id = _store.id AND p.is_active = true
            AND p.hidden_by_category = false AND p.category = c.name
        )
      ) ORDER BY c.display_order, c.name
    ), '[]'::json
  ) INTO _categories
  FROM categories c WHERE c.store_id = _store.id AND c.is_hidden = false;

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'name', p.name,
        'slug', p.slug,
        'price', p.price,
        'sale_price', p.sale_price,
        'currency', p.currency,
        'image_url', p.image_url,
        'category', p.category,
        'description', p.description,
        'stock_quantity', p.stock_quantity,
        'updated_at', p.updated_at
      ) ORDER BY p.is_best_selling DESC NULLS LAST, p.display_order, p.created_at DESC
    ), '[]'::json
  ) INTO _products
  FROM (
    SELECT *
    FROM products
    WHERE store_id = _store.id AND is_active = true AND hidden_by_category = false
    ORDER BY is_best_selling DESC NULLS LAST, display_order, created_at DESC
    LIMIT 200
  ) p;

  RETURN json_build_object(
    'store', json_build_object(
      'id', _store.id,
      'name', _store.name,
      'slug', _store.slug,
      'description', _store.description,
      'logo_url', _store.logo_url,
      'banner_url', _store.banner_url,
      'og_image_url', _store.og_image_url,
      'currency', _store.currency,
      'whatsapp_number', _store.whatsapp_number,
      'instagram_url', _store.instagram_url,
      'facebook_url', _store.facebook_url,
      'location', _store.location,
      'city', _store.city,
      'state', _store.state,
      'business_hours', _store.business_hours,
      'custom_domain', _store.custom_domain,
      'meta_title', _store.meta_title,
      'meta_description', _store.meta_description,
      'about_us_text', _store.about_us_text,
      'return_policy', _store.return_policy,
      'shipping_policy', _store.shipping_policy,
      'seo_about_paragraph', _store.seo_about_paragraph,
      'faq_items', _store.faq_items,
      'usp_bullets', _store.usp_bullets,
      'updated_at', _store.updated_at
    ),
    'categories', _categories,
    'products', _products
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_storefront_shell(_slug text, _with_pages boolean DEFAULT true)
 RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
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

  SELECT COALESCE(json_agg(c ORDER BY c.display_order, c.name), '[]'::json) INTO _categories
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
      json_agg(
        json_build_object(
          'id', sp.id,
          'title', sp.title,
          'slug', sp.slug,
          'content', sp.content,
          'image_url', sp.image_url
        )
        ORDER BY sp.display_order
      ),
      '[]'::json
    ) INTO _custom_pages
    FROM store_pages sp
    WHERE sp.store_id = _store.id
      AND sp.page_type = 'custom'
      AND sp.is_active = true;

    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', sp.id,
          'page_type', sp.page_type,
          'title', sp.title,
          'slug', sp.slug,
          'content', sp.content,
          'custom_html', sp.custom_html,
          'image_url', sp.image_url
        )
        ORDER BY sp.display_order
      ),
      '[]'::json
    ) INTO _standard_pages
    FROM store_pages sp
    WHERE sp.store_id = _store.id
      AND sp.page_type IN ('about', 'about_us', 'contact')
      AND sp.is_active = true;
  ELSE
    _custom_pages := '[]'::json;
    _standard_pages := '[]'::json;
  END IF;

  SELECT COALESCE(
    json_agg(
      json_build_object(
        'id', p.id,
        'category', p.category,
        'currency', p.currency,
        'description', p.description,
        'image_url', p.image_url,
        'is_active', p.is_active,
        'is_best_selling', p.is_best_selling,
        'name', p.name,
        'price', p.price,
        'sale_price', p.sale_price,
        'slug', p.slug,
        'stock_quantity', p.stock_quantity,
        'store_id', p.store_id, 'video_url', p.video_url, 'video_poster_url', p.video_poster_url
      )
      ORDER BY p.is_best_selling DESC NULLS LAST, p.created_at DESC, p.id ASC
    ),
    '[]'::json
  ) INTO _products_preview
  FROM (
    SELECT *
    FROM products
    WHERE store_id = _store.id AND is_active = true AND hidden_by_category = false
    ORDER BY is_best_selling DESC NULLS LAST, created_at DESC, id ASC
    LIMIT 20
  ) p;

  _store_json := to_jsonb(_store)
    - 'meta_access_token'
    - 'owner_email'
    - 'domain_verification_token'
    - 'suspension_reason'
    - 'referred_by_partner_id'
    - 'default_profit_margin';

  RETURN json_build_object(
    'store', _store_json,
    'categories', COALESCE(_categories, '[]'::json),
    'theme_config', _theme_config,
    'shipping_config', _shipping_config,
    'custom_pages', COALESCE(_custom_pages, '[]'::json),
    'standard_pages', COALESCE(_standard_pages, '[]'::json),
    'total_products', COALESCE(_total_products, 0),
    'meta_capi_enabled', _meta_capi_enabled,
    'products_preview', COALESCE(_products_preview, '[]'::json)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_products(p_store_id uuid, p_query text DEFAULT ''::text, p_limit integer DEFAULT 24, p_offset integer DEFAULT 0, p_sort text DEFAULT 'relevance'::text, p_min_price numeric DEFAULT NULL::numeric, p_max_price numeric DEFAULT NULL::numeric, p_category text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, slug text, price numeric, sale_price numeric, image_url text, category text, stock_quantity integer, is_best_selling boolean, sku text, currency text, created_at timestamp with time zone, score real, total_count bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH params AS (
  SELECT
    lower(btrim(coalesce(p_query, ''))) AS q,
    least(greatest(coalesce(p_limit, 24), 1), 100) AS lim,
    greatest(coalesce(p_offset, 0), 0) AS off
),
toks AS (
  SELECT array(
    SELECT lower(t)
    FROM regexp_split_to_table((SELECT q FROM params), '[^[:alnum:]]+') AS t
    WHERE length(t) > 0
  ) AS words
),
tsq AS (
  SELECT CASE
    WHEN coalesce(array_length((SELECT words FROM toks), 1), 0) = 0 THEN NULL
    ELSE to_tsquery('simple',
      array_to_string(
        ARRAY(SELECT quote_literal(w) || ':*' FROM unnest((SELECT words FROM toks)) w),
        ' & '))
  END AS tq
),
base AS (
  SELECT p.id, p.name, p.slug, p.price, p.sale_price, p.image_url, p.category,
         p.stock_quantity, p.is_best_selling, p.sku, p.currency, p.created_at,
         p.search_tsv
  FROM public.products p
  WHERE p.store_id = p_store_id
    AND p.is_active = true
    AND p.hidden_by_category = false
    AND (p_category IS NULL OR lower(p.category) = lower(p_category))
    AND (p_min_price IS NULL OR coalesce(p.sale_price, p.price) >= p_min_price)
    AND (p_max_price IS NULL OR coalesce(p.sale_price, p.price) <= p_max_price)
),
scored AS (
  SELECT b.*,
    (
      CASE WHEN (SELECT q FROM params) <> '' AND lower(b.name) LIKE '%' || (SELECT q FROM params) || '%'
           THEN 6.0 ELSE 0 END
      + CASE WHEN (SELECT q FROM params) <> '' AND lower(b.name) LIKE (SELECT q FROM params) || '%'
             THEN 3.0 ELSE 0 END
      + CASE WHEN (SELECT tq FROM tsq) IS NOT NULL AND b.search_tsv @@ (SELECT tq FROM tsq)
             THEN 4.0 + 8.0 * ts_rank(b.search_tsv, (SELECT tq FROM tsq))
             ELSE 0 END
      + CASE WHEN (SELECT q FROM params) <> '' AND lower(coalesce(b.sku, '')) = (SELECT q FROM params)
             THEN 8.0 ELSE 0 END
      + 7.0 * coalesce(tok.avg_sim, 0)
    )::real AS match_score
  FROM base b
  LEFT JOIN LATERAL (
    SELECT avg(
      greatest(
        CASE WHEN lower(b.name) LIKE '%' || w || '%' THEN 1.0 ELSE 0 END,
        CASE WHEN lower(coalesce(b.category, '')) LIKE '%' || w || '%' THEN 0.85 ELSE 0 END,
        word_similarity(w, lower(b.name)),
        similarity(w, lower(coalesce(b.category, ''))) * 0.7
      )
    ) AS avg_sim
    FROM unnest((SELECT words FROM toks)) AS w
  ) tok ON true
),
filtered AS (
  SELECT s.*,
    (s.match_score
      + CASE WHEN coalesce(s.stock_quantity, 0) > 0 THEN 0.6 ELSE 0 END
      + CASE WHEN s.is_best_selling THEN 0.5 ELSE 0 END
      + CASE WHEN coalesce(s.image_url, '') <> '' THEN 0.3 ELSE 0 END
    )::real AS score
  FROM scored s
  WHERE (SELECT q FROM params) = '' OR s.match_score >= 2.0
),
counted AS (
  SELECT f.*, count(*) OVER () AS total_count FROM filtered f
)
SELECT c.id, c.name, c.slug, c.price, c.sale_price, c.image_url, c.category,
       c.stock_quantity, c.is_best_selling, c.sku, c.currency, c.created_at,
       c.score, c.total_count
FROM counted c
ORDER BY
  CASE WHEN p_sort = 'price_asc'  THEN coalesce(c.sale_price, c.price) END ASC NULLS LAST,
  CASE WHEN p_sort = 'price_desc' THEN coalesce(c.sale_price, c.price) END DESC NULLS LAST,
  CASE WHEN p_sort = 'newest'     THEN c.created_at END DESC NULLS LAST,
  CASE WHEN p_sort NOT IN ('price_asc','price_desc','newest') THEN c.score END DESC NULLS LAST,
  c.created_at DESC,
  c.id
LIMIT (SELECT lim FROM params) OFFSET (SELECT off FROM params);
$function$;

CREATE OR REPLACE FUNCTION public.search_suggest_terms(p_store_id uuid, p_query text DEFAULT ''::text, p_limit integer DEFAULT 6)
 RETURNS TABLE(term text, kind text, hits bigint)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT c.category AS term, 'category'::text AS kind, count(*) AS hits
  FROM public.products c
  WHERE c.store_id = p_store_id
    AND c.is_active = true
    AND c.hidden_by_category = false
    AND c.category IS NOT NULL AND c.category <> ''
    AND (
      btrim(coalesce(p_query, '')) = ''
      OR lower(c.category) LIKE '%' || lower(btrim(p_query)) || '%'
      OR similarity(lower(c.category), lower(btrim(p_query))) > 0.3
    )
  GROUP BY c.category
  ORDER BY hits DESC
  LIMIT least(greatest(coalesce(p_limit, 6), 1), 20);
$function$;