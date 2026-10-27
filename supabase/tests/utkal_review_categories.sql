DO $$
DECLARE _n int;
BEGIN
  SELECT count(*) INTO _n FROM public.product_categories pc JOIN public.categories c ON c.id=pc.category_id
  WHERE c.store_id='ab19143d-87a9-490e-90b7-837313522782' AND pc.store_id=c.store_id AND c.slug='recently-classified-watches';
  IF _n<>519 THEN RAISE EXCEPTION 'Expected 519 repaired watches, found %',_n; END IF;
  SELECT count(*) INTO _n FROM public.product_categories pc JOIN public.categories c ON c.id=pc.category_id
  WHERE c.store_id='ab19143d-87a9-490e-90b7-837313522782' AND pc.store_id=c.store_id AND c.slug='unclassified-watches';
  IF _n<>1664 THEN RAISE EXCEPTION 'Expected 1664 unclassified entries, found %',_n; END IF;
END $$;