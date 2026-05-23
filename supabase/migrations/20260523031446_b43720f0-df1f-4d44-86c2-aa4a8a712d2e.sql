-- Deep security hardening: column-level privileges for sensitive fields.
-- RLS still controls row access, but these revokes prevent accidental direct
-- client-side reads of sensitive columns if a public/owner policy is broad.

-- Store-level private fields: storefront-safe data continues through RPCs.
REVOKE SELECT (owner_email, meta_access_token, domain_verification_token, suspension_reason, default_profit_margin, referred_by_partner_id)
ON public.stores FROM anon, authenticated;

-- Payment secrets: never directly readable from browser clients.
REVOKE SELECT (razorpay_key_secret, cashfree_secret_key)
ON public.store_payment_config FROM anon, authenticated;

-- WhatsApp/platform tokens: backend-only.
REVOKE SELECT (access_token)
ON public.whatsapp_config FROM anon, authenticated;

REVOKE SELECT (wa_access_token)
ON public.platform_config FROM anon, authenticated;

-- Customer/contact/order PII and tracking signals.
REVOKE SELECT (customer_email, customer_phone, session_token)
ON public.abandoned_carts FROM anon, authenticated;

REVOKE SELECT (phone)
ON public.customer_leads FROM anon, authenticated;

REVOKE SELECT (email, phone, address)
ON public.customers FROM anon, authenticated;

REVOKE SELECT (customer_phone, street_address, pincode, notes, checkout_token, buyer_ip, buyer_user_agent, buyer_fbc, buyer_fbp)
ON public.orders FROM anon, authenticated;

REVOKE SELECT (customer_phone)
ON public.whatsapp_orders FROM anon, authenticated;

REVOKE SELECT (email, phone)
ON public.storefront_customers FROM anon, authenticated;

-- Tokens and suppression lists.
REVOKE SELECT (token, email)
ON public.email_unsubscribe_tokens FROM anon, authenticated;

REVOKE SELECT (email)
ON public.suppressed_emails FROM anon, authenticated;

REVOKE SELECT (phone)
ON public.whatsapp_optouts FROM anon, authenticated;

-- Browser push subscription secrets.
REVOKE SELECT (endpoint, p256dh, auth)
ON public.push_subscriptions FROM anon, authenticated;

-- Partner private payout data.
REVOKE SELECT (upi_id, bank_account_no, bank_ifsc, bank_account_name, admin_note, payout_ref)
ON public.partner_withdrawals FROM anon, authenticated;

REVOKE SELECT (flagged_reason)
ON public.partner_referrals FROM anon, authenticated;

REVOKE SELECT (notes)
ON public.partner_wallet_ledger FROM anon, authenticated;

-- Store plan/admin notes.
REVOKE SELECT (notes)
ON public.store_plan_assignments FROM anon, authenticated;

-- Public storefront shell should not expose owner email.
DROP FUNCTION IF EXISTS public.get_storefront_shell(text, boolean);
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
  _store_json json;
  _total_products bigint;
  _meta_capi_enabled boolean;
  _products_preview json;
BEGIN
  SELECT * INTO _store FROM stores WHERE slug = _slug LIMIT 1;
  IF _store.id IS NULL THEN
    RETURN json_build_object('store', null, 'categories', '[]'::json, 'theme_config', null, 'shipping_config', null, 'custom_pages', '[]'::json, 'total_products', 0, 'meta_capi_enabled', false, 'products_preview', '[]'::json);
  END IF;

  IF COALESCE(_store.is_suspended, false) THEN
    RETURN json_build_object('store', null, 'categories', '[]'::json, 'theme_config', null, 'shipping_config', null, 'custom_pages', '[]'::json, 'total_products', 0, 'meta_capi_enabled', false, 'products_preview', '[]'::json);
  END IF;

  _meta_capi_enabled := (_store.meta_access_token IS NOT NULL AND length(trim(_store.meta_access_token)) > 0);

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
  ELSE
    _custom_pages := '[]'::json;
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

  SELECT json_build_object(
    'id', _store.id, 'name', _store.name, 'slug', _store.slug,
    'description', _store.description, 'logo_url', _store.logo_url,
    'banner_url', _store.banner_url, 'mobile_hero_url', _store.mobile_hero_url,
    'mobile_hero_images', _store.mobile_hero_images, 'currency', _store.currency,
    'whatsapp_number', _store.whatsapp_number, 'instagram_url', _store.instagram_url,
    'facebook_url', _store.facebook_url, 'order_mode', _store.order_mode,
    'theme', _store.theme, 'features', _store.features,
    'best_selling_carousel', _store.best_selling_carousel,
    'meta_title', _store.meta_title, 'meta_description', _store.meta_description,
    'og_image_url', _store.og_image_url, 'facebook_pixel_id', _store.facebook_pixel_id,
    'location', _store.location, 'city', _store.city, 'state', _store.state,
    'business_hours', _store.business_hours, 'custom_domain', _store.custom_domain,
    'return_policy', _store.return_policy, 'shipping_policy', _store.shipping_policy,
    'is_suspended', _store.is_suspended, 'is_verified', _store.is_verified,
    'created_at', _store.created_at, 'updated_at', _store.updated_at,
    'about_us_text', _store.about_us_text,
    'about_us_image_url', _store.about_us_image_url,
    'partial_payment_enabled', _store.partial_payment_enabled,
    'partial_payment_type', _store.partial_payment_type,
    'partial_payment_value', _store.partial_payment_value
  ) INTO _store_json;

  RETURN json_build_object(
    'store', _store_json,
    'categories', _categories,
    'theme_config', _theme_config,
    'shipping_config', _shipping_config,
    'custom_pages', _custom_pages,
    'total_products', _total_products,
    'meta_capi_enabled', _meta_capi_enabled,
    'products_preview', _products_preview
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_storefront_shell(text, boolean) TO anon, authenticated;

-- Limit explicit secret-retrieval RPCs to authenticated owners only.
REVOKE EXECUTE ON FUNCTION public.get_own_payment_secret(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_own_cashfree_secret(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_own_store_meta_token(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_own_domain_token(uuid) FROM anon;