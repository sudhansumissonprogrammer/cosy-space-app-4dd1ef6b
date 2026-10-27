DO $migration$
DECLARE fn record; definition text;
BEGIN
  FOR fn IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('get_category_page','get_category_products_page','get_category_products_page_by_slug') LOOP
    definition := pg_get_functiondef(fn.oid);
    definition := replace(definition, 'ORDER BY p.is_category_pinned DESC', 'ORDER BY CASE WHEN _store_id = ''ab19143d-87a9-490e-90b7-837313522782''::uuid THEN p.created_at END DESC NULLS LAST, p.is_category_pinned DESC');
    definition := replace(definition, 'ORDER BY is_category_pinned DESC', 'ORDER BY CASE WHEN _store_id = ''ab19143d-87a9-490e-90b7-837313522782''::uuid THEN created_at END DESC NULLS LAST, is_category_pinned DESC');
    EXECUTE definition;
  END LOOP;
END $migration$;