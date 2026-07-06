
-- get_wa_redirect(token): resolves a WhatsApp branded-link token to its
-- destination URL + preload hints in a single round trip. Runs SECURITY
-- DEFINER so the Cloudflare Worker can call it with the anon key without
-- exposing order/cart/product tables directly.
CREATE OR REPLACE FUNCTION public.get_wa_redirect(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _kind text;
  _id text;
  _base text;
  _host text;
  _target text;
  _hero text;
  _slug text;
  _ttl int;
  _status int;
  o record;
  c record;
  p record;
BEGIN
  IF _token IS NULL OR length(_token) < 3 THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  _kind := substr(_token, 1, 2);
  _id   := substr(_token, 3);

  IF _kind IN ('o-', 't-') THEN
    SELECT ord.id, ord.tracking_url, s.slug, s.custom_domain
      INTO o
      FROM orders ord
      JOIN stores s ON s.id = ord.store_id
     WHERE ord.id::text = _id
     LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
    _host := COALESCE(o.custom_domain, o.slug || '.shopbanao.in');
    _base := 'https://' || _host;
    IF _kind = 't-' AND o.tracking_url IS NOT NULL AND o.tracking_url <> '' THEN
      _target := o.tracking_url;
      _status := 302; _ttl := 60;
    ELSE
      _target := _base || '/account/orders/' || o.id::text;
      _status := 301; _ttl := 86400;
    END IF;
    RETURN jsonb_build_object('ok', true, 'kind', _kind, 'target', _target,
      'host', _host, 'status', _status, 'ttl', _ttl);
  END IF;

  IF _kind = 'c-' THEN
    SELECT ac.id, ac.session_token, s.slug, s.custom_domain
      INTO c
      FROM abandoned_carts ac
      JOIN stores s ON s.id = ac.store_id
     WHERE ac.id::text = _id
     LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
    _host := COALESCE(c.custom_domain, c.slug || '.shopbanao.in');
    _base := 'https://' || _host;
    _target := _base || '/cart?recover=' || COALESCE(c.session_token, c.id::text);
    RETURN jsonb_build_object('ok', true, 'kind', _kind, 'target', _target,
      'host', _host, 'status', 302, 'ttl', 0);
  END IF;

  IF _kind = 'p-' THEN
    SELECT pr.id, pr.slug AS pslug, s.slug AS sslug, s.custom_domain,
           (SELECT image_url FROM product_images
              WHERE product_id = pr.id
              ORDER BY display_order ASC NULLS LAST LIMIT 1) AS hero
      INTO p
      FROM products pr
      JOIN stores s ON s.id = pr.store_id
     WHERE pr.id::text = _id
     LIMIT 1;
    IF NOT FOUND THEN RETURN jsonb_build_object('ok', false); END IF;
    _host := COALESCE(p.custom_domain, p.sslug || '.shopbanao.in');
    _base := 'https://' || _host;
    _slug := p.pslug;
    IF _slug IS NULL OR _slug = '' THEN
      _target := _base;
    ELSE
      _target := _base || '/product/' || _slug;
    END IF;
    _hero := CASE WHEN p.hero LIKE 'http%' THEN p.hero ELSE NULL END;
    RETURN jsonb_build_object('ok', true, 'kind', _kind, 'target', _target,
      'host', _host, 'status', 302, 'ttl', 300,
      'slug', _slug, 'hero', _hero);
  END IF;

  RETURN jsonb_build_object('ok', false);
END;
$$;

REVOKE ALL ON FUNCTION public.get_wa_redirect(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_wa_redirect(text) TO anon, authenticated, service_role;
