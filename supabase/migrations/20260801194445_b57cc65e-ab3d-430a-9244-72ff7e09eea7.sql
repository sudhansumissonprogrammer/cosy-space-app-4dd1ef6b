CREATE OR REPLACE FUNCTION public.get_checkout_line_item(_product_id uuid, _variant_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'product', (
      SELECT to_jsonb(x) FROM (
        SELECT p.id, p.store_id, p.name, p.description, p.price, p.currency, p.sku,
               p.stock_quantity, p.is_active, p.image_url, p.slug, p.sale_price,
               p.category, p.has_variants, p.partial_payment_enabled,
               p.partial_payment_type, p.partial_payment_value,
               p.image_alt, p.og_image_url, p.video_url, p.video_poster_url
        FROM public.products p
        WHERE p.id = _product_id AND p.is_active = true
      ) x
    ),
    'variant', (
      SELECT to_jsonb(v) FROM (
        SELECT pv.id, pv.product_id, pv.name, pv.sku, pv.price, pv.stock_quantity, pv.is_active
        FROM public.product_variants pv
        WHERE _variant_id IS NOT NULL
          AND pv.id = _variant_id
          AND pv.product_id = _product_id
          AND pv.is_active = true
      ) v
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_checkout_line_item(uuid, uuid) TO anon, authenticated, service_role;