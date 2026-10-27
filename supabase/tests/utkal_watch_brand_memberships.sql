-- Run through the privileged database test connection; rolls back on failure.
DO $$
BEGIN
  IF public.utkal_watch_title_brand('Diver''s Blue Pro Automatic') IS NOT NULL THEN RAISE EXCEPTION 'Generic title must remain unclassified'; END IF;
  IF public.utkal_watch_title_brand('Field Green Canvas Strap') IS NOT NULL THEN RAISE EXCEPTION 'Generic title must remain unclassified'; END IF;
  IF public.utkal_watch_title_brand('Omegg_a Seamaster Aqua Terra') IS DISTINCT FROM 'Omega' THEN RAISE EXCEPTION 'Omega alias'; END IF;
  IF public.utkal_watch_title_brand('TOMMY_CHRONOGRAPH') IS DISTINCT FROM 'Tommy Hilfiger' THEN RAISE EXCEPTION 'Tommy alias'; END IF;
  IF public.utkal_watch_title_brand('CK LADIES_ROSE-WHITE') IS DISTINCT FROM 'Calvin Klein' THEN RAISE EXCEPTION 'CK alias'; END IF;
  IF public.utkal_watch_title_brand('Se ko 5 Sports GMT') IS DISTINCT FROM 'Seiko' THEN RAISE EXCEPTION 'Seiko alias'; END IF;
  IF public.utkal_repair_watch_brand_links('cf96c70a-91e1-4ace-b8de-fe9e300beb61') <> '{"categories":0,"brand_links":0}'::jsonb THEN RAISE EXCEPTION 'Other store must remain untouched'; END IF;
END $$;