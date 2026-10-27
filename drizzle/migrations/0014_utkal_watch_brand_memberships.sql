CREATE OR REPLACE FUNCTION public.utkal_watch_title_brand(_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 WITH n AS (SELECT regexp_replace(regexp_replace(lower(_name),'[^a-z]','','g'),'(.)\1+','\1','g') k),
 aliases(brand,pattern) AS (VALUES
 ('Rolex','^(rolex|rolx)'), ('Tissot','^(tisot|tiso)'), ('Rado','^(rado|rado)'), ('Omega','^(omega|omeg)'),
 ('Seiko','^(seiko|seko|seik)'), ('Casio','^(casio|edifice)'), ('G-Shock','^(gshock|gshok)'),
 ('Tag Heuer','^(tagheuer|tagheur|tegheuer|tagh|tagcr|taggrand)'), ('Fossil','^(fosil|fosi)'), ('Hublot','^hublot'),
 ('Patek Philippe','^patek'), ('Audemars Piguet','^(audemars|appop)'), ('Richard Mille','^richardmil'),
 ('Cartier','^(cartier|carter)'), ('Armani','^(armani|arma|emporio)'), ('Tommy Hilfiger','^tomy'),
 ('Diesel','^diesel'), ('Gucci','^guci'), ('Louis Vuitton','^louisvuit'), ('Burberry','^burber'),
 ('Versace','^versac'), ('Hugo Boss','^(hugobos|bos)'), ('Calvin Klein','^(calvinklein|calvin)'),
 ('Michael Kors','^(michaelk|michaek)'), ('Guess','^gues'), ('Swatch','^swatch'), ('Bvlgari','^(bvlgari|bulgari|bvlgary)'),
 ('Vacheron Constantin','^vacheron'), ('Jacob & Co','^jacob'), ('Maserati','^maserati'), ('Titan','^titan'),
 ('Fendi','^fendi'), ('Tudor','^tudor'), ('Breitling','^(breitling|brietling)'), ('Montblanc','^montblanc'),
 ('Dior','^dior'), ('Longines','^longines'), ('Citizen','^citizen'), ('Invicta','^invicta'), ('IWC','^iwc'),
 ('Boucheron','^boucheron'), ('Movado','^movado'), ('Orient','^(orient|oreint)'), ('Nike','^nike'),
 ('Oakley','^(oakley|okley)'), ('Ferrari','^ferari'), ('Lamborghini','^lamborghini'), ('Seven Friday','^sevenfriday'),
 ('Swarovski','^swarovs'), ('Daniel Wellington','^danielwelington'), ('Tiffany & Co','^tifany'),
 ('Bell & Ross','^(belros|belnros|belrose)'), ('Panerai','^(panerai|radiomirpanerai|luminorpanerai|luminourpanerai|luminorsubmersiblepanrai)'),
 ('Just Cavalli','^justc[ae]vali'), ('Roberto Cavalli','^robertocavali'), ('Roger Dubuis','^rogerdubuis'),
 ('Franck Muller','^fran[ck]+muler'), ('Raymond Weil','^raymondweil'), ('Maurice Lacroix','^mauricelacroix'),
 ('Jaeger-LeCoultre','^jaegerlecoultre'), ('Ulysse Nardin','^uly[sz]senardin'), ('Chanel','^(chanel|channel)'),
 ('Coach','^(coach|coack)'), ('Corum','^corum'), ('Aigner','^aigner'), ('Breda','^breda'), ('Breguet','^(breguet|breuget)'),
 ('Ferragamo','^feragamo'), ('Mashali','^mashali'), ('Aura','^(aura|arabicaura)'), ('Givenchy','^givenchy'),
 ('Graham','^graham'), ('Julius','^julius'), ('Fiyta','^fiyta'), ('Olevs','^olevs'), ('Olivia Burton','^oliviaburton'),
 ('Police','^police'), ('U-Boat','^uboat'), ('Whoop','^whoop'), ('Lige','^lige'), ('Sabr','^sabr'), ('Chen Xi','^chenxi')
 ) SELECT CASE
 WHEN _name ~* '^[_[:space:]]*c[_[:space:]]*k([^a-z]|$)' THEN 'Calvin Klein'
 WHEN _name ~* '^[_[:space:]]*d[_[:space:]]*w([^a-z]|$)' THEN 'Daniel Wellington'
 WHEN _name ~* '^[_[:space:]]*m[_[:space:]]*k([^a-z]|$)' THEN 'Michael Kors'
 WHEN _name ~* '^[_[:space:]]*l[_[:space:]]*v([^a-z]|$)' THEN 'Louis Vuitton'
 WHEN _name ~* '^0mega([^a-z]|$)' THEN 'Omega'
 ELSE (SELECT a.brand FROM aliases a,n WHERE n.k ~ a.pattern ORDER BY length(a.pattern) DESC,a.brand LIMIT 1) END;
$$;
REVOKE ALL ON FUNCTION public.utkal_watch_title_brand(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.utkal_watch_title_brand(text) TO service_role;

CREATE OR REPLACE FUNCTION public.utkal_repair_watch_brand_links(_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _newcats int := 0; _links int := 0;
BEGIN
 IF _store_id <> 'ab19143d-87a9-490e-90b7-837313522782'::uuid THEN RETURN jsonb_build_object('categories',0,'brand_links',0); END IF;
 WITH missing AS (
 SELECT p.id, public.utkal_watch_title_brand(p.name) brand,
 CASE WHEN coalesce(p.category,'') ~* 'women|ladies' OR p.name ~* '\m(women|womens|woman|ladies|ladie|lady|her|female)\M' THEN 'Women' ELSE 'Men' END gender
 FROM products p WHERE p.store_id=_store_id AND (coalesce(p.category,'') ILIKE '%watch%' OR EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id=pc.category_id AND c.store_id=pc.store_id WHERE pc.product_id=p.id AND pc.store_id=_store_id AND c.name ILIKE '%watch%'))
 AND NOT EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id=pc.category_id AND c.store_id=pc.store_id WHERE pc.product_id=p.id AND pc.store_id=_store_id AND c.name ~ '^.+ Watch (Men|Women)$')
 ), wanted AS (SELECT DISTINCT brand||' Watch '||gender name FROM missing m WHERE brand IS NOT NULL
 AND NOT EXISTS (SELECT 1 FROM categories c WHERE c.store_id=_store_id AND c.name IN (m.brand||' Watch Men',m.brand||' Watch Women'))), ins AS (
 INSERT INTO categories(store_id,name,slug,display_order,show_on_home,is_hidden)
 SELECT _store_id,name,trim(both '-' from regexp_replace(lower(replace(name,'&','and')),'[^a-z0-9]+','-','g')),1000,false,false FROM wanted
 ON CONFLICT(store_id,slug) DO NOTHING RETURNING 1
 ) SELECT count(*) INTO _newcats FROM ins;
 WITH missing AS (
 SELECT p.id, public.utkal_watch_title_brand(p.name) brand,
 CASE WHEN coalesce(p.category,'') ~* 'women|ladies' OR p.name ~* '\m(women|womens|woman|ladies|ladie|lady|her|female)\M' THEN 'Women' ELSE 'Men' END gender
 FROM products p WHERE p.store_id=_store_id AND (coalesce(p.category,'') ILIKE '%watch%' OR EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id=pc.category_id AND c.store_id=pc.store_id WHERE pc.product_id=p.id AND pc.store_id=_store_id AND c.name ILIKE '%watch%'))
 AND NOT EXISTS (SELECT 1 FROM product_categories pc JOIN categories c ON c.id=pc.category_id AND c.store_id=pc.store_id WHERE pc.product_id=p.id AND pc.store_id=_store_id AND c.name ~ '^.+ Watch (Men|Women)$')
 ), matched AS (
 SELECT DISTINCT ON (m.id) m.id pid,c.id cid FROM missing m JOIN categories c ON c.store_id=_store_id AND c.name IN (m.brand||' Watch Men',m.brand||' Watch Women')
 ORDER BY m.id,(c.name=m.brand||' Watch '||m.gender) DESC,c.id
 ), ins AS (
 INSERT INTO product_categories(product_id,category_id,store_id,is_primary) SELECT pid,cid,_store_id,false FROM matched ON CONFLICT DO NOTHING RETURNING 1
 ) SELECT count(*) INTO _links FROM ins;
 RETURN jsonb_build_object('categories',_newcats,'brand_links',_links);
END $$;
REVOKE ALL ON FUNCTION public.utkal_repair_watch_brand_links(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.utkal_repair_watch_brand_links(uuid) TO service_role;