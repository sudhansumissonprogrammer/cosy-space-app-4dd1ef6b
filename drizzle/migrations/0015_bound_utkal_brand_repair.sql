CREATE OR REPLACE FUNCTION public.utkal_repair_watch_brand_links(_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _newcats int := 0; _links int := 0;
BEGIN
 IF _store_id <> 'ab19143d-87a9-490e-90b7-837313522782'::uuid THEN RETURN jsonb_build_object('categories',0,'brand_links',0); END IF;
 CREATE TEMP TABLE IF NOT EXISTS utkal_brand_repair_work(pid uuid,brand text,gender text) ON COMMIT DROP;
 TRUNCATE pg_temp.utkal_brand_repair_work;
 INSERT INTO pg_temp.utkal_brand_repair_work
 WITH brandcats AS MATERIALIZED (SELECT id FROM categories WHERE store_id=_store_id AND name ~ '^.+ Watch (Men|Women)$'),
 classified AS MATERIALIZED (SELECT DISTINCT pc.product_id FROM product_categories pc JOIN brandcats c ON c.id=pc.category_id WHERE pc.store_id=_store_id),
 watches AS MATERIALIZED (SELECT DISTINCT pc.product_id FROM product_categories pc JOIN categories c ON c.id=pc.category_id AND c.store_id=pc.store_id WHERE pc.store_id=_store_id AND c.name ILIKE '%watch%'),
 missing AS MATERIALIZED (SELECT p.id,p.name,p.category FROM products p LEFT JOIN classified b ON b.product_id=p.id LEFT JOIN watches w ON w.product_id=p.id WHERE p.store_id=_store_id AND b.product_id IS NULL AND (coalesce(p.category,'') ILIKE '%watch%' OR w.product_id IS NOT NULL))
 SELECT id,public.utkal_watch_title_brand(name),CASE WHEN coalesce(category,'') ~* 'women|ladies' OR name ~* '\m(women|womens|woman|ladies|ladie|lady|her|female)\M' THEN 'Women' ELSE 'Men' END FROM missing;
 WITH wanted AS (SELECT DISTINCT m.brand||' Watch '||m.gender name FROM pg_temp.utkal_brand_repair_work m WHERE brand IS NOT NULL AND NOT EXISTS(SELECT 1 FROM categories c WHERE c.store_id=_store_id AND c.name IN(m.brand||' Watch Men',m.brand||' Watch Women'))), ins AS (
 INSERT INTO categories(store_id,name,slug,display_order,show_on_home,is_hidden)
 SELECT _store_id,name,trim(both '-' from regexp_replace(lower(replace(name,'&','and')),'[^a-z0-9]+','-','g')),1000,false,false FROM wanted ON CONFLICT(store_id,slug) DO NOTHING RETURNING 1)
 SELECT count(*) INTO _newcats FROM ins;
 WITH matched AS (SELECT DISTINCT ON(m.pid) m.pid,c.id cid FROM pg_temp.utkal_brand_repair_work m JOIN categories c ON c.store_id=_store_id AND c.name IN(m.brand||' Watch Men',m.brand||' Watch Women') ORDER BY m.pid,(c.name=m.brand||' Watch '||m.gender) DESC,c.id), ins AS (
 INSERT INTO product_categories(product_id,category_id,store_id,is_primary) SELECT pid,cid,_store_id,false FROM matched ON CONFLICT DO NOTHING RETURNING 1)
 SELECT count(*) INTO _links FROM ins;
 RETURN jsonb_build_object('categories',_newcats,'brand_links',_links);
END $$;
REVOKE ALL ON FUNCTION public.utkal_repair_watch_brand_links(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.utkal_repair_watch_brand_links(uuid) TO service_role;