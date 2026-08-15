CREATE OR REPLACE FUNCTION public.jd_bulk_import(p_token text, p_action text, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store uuid := 'ab19143d-87a9-490e-90b7-837313522782';
  r jsonb;
  img jsonb;
  n int := 0;
BEGIN
  IF p_token <> 'jd-import-7f3a91c2e5' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_action = 'reset' THEN
    DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE store_id = v_store);
    DELETE FROM product_variants WHERE product_id IN (SELECT id FROM products WHERE store_id = v_store);
    DELETE FROM products WHERE store_id = v_store;
    DELETE FROM categories WHERE store_id = v_store;
    RETURN jsonb_build_object('ok', true);
  END IF;

  IF p_action = 'categories' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_payload) LOOP
      INSERT INTO categories (store_id, name, slug, image_url, display_order)
      VALUES (v_store, r->>'name', r->>'slug', r->>'image_url', (r->>'display_order')::int);
      n := n + 1;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'count', n);
  END IF;

  IF p_action = 'products' THEN
    FOR r IN SELECT * FROM jsonb_array_elements(p_payload) LOOP
      INSERT INTO products (id, store_id, name, slug, price, sale_price, currency, description,
                            image_url, video_url, stock_quantity, is_active, display_order, category)
      VALUES ((r->>'id')::uuid, v_store, r->>'name', r->>'slug', (r->>'price')::numeric,
              NULLIF(r->>'sale_price','')::numeric, 'INR', r->>'description', r->>'image_url',
              r->>'video_url', COALESCE((r->>'stock')::int, 0), true,
              (r->>'display_order')::int, r->>'category');
      FOR img IN SELECT * FROM jsonb_array_elements(COALESCE(r->'images', '[]'::jsonb)) LOOP
        INSERT INTO product_images (product_id, image_url, display_order)
        VALUES ((r->>'id')::uuid, img->>'url', (img->>'display_order')::int);
      END LOOP;
      n := n + 1;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'count', n);
  END IF;

  RAISE EXCEPTION 'unknown action';
END;
$$;

GRANT EXECUTE ON FUNCTION public.jd_bulk_import(text, text, jsonb) TO anon, authenticated;