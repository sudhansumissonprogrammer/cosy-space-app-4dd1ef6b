CREATE OR REPLACE FUNCTION public.get_storefront_shell(_slug text, _with_pages boolean DEFAULT true)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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

  SELECT COUNT(*) INTO _total_products FROM products WHERE store_id = _store.id AND is_active = true;

  SELECT COALESCE(json_agg(c ORDER BY c.display_order, c.name), '[]'::json) INTO _categories
  FROM categories c WHERE c.store_id = _store.id;

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
        'store_id', p.store_id
      )
      ORDER BY p.is_best_selling DESC NULLS LAST, p.created_at DESC, p.id ASC
    ),
    '[]'::json
  ) INTO _products_preview
  FROM (
    SELECT *
    FROM products
    WHERE store_id = _store.id AND is_active = true
    ORDER BY is_best_selling DESC NULLS LAST, created_at DESC, id ASC
    LIMIT 20
  ) p;

  -- Strip every sensitive column before the store payload leaves the RPC.
  -- These were previously exposed to anonymous visitors:
  --  meta_access_token           (already stripped)
  --  owner_email                 (contact/PII → phishing / competitor scraping)
  --  domain_verification_token   (lets an attacker verify the domain elsewhere)
  --  suspension_reason           (internal moderation note)
  --  referred_by_partner_id      (internal attribution)
  --  default_profit_margin       (business intelligence leak)
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