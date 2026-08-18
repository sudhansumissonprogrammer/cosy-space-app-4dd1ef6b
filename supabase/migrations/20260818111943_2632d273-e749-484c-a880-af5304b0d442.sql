DO $mig$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO d FROM pg_proc WHERE proname='get_storefront_shell' LIMIT 1;
  IF position('video_url' in d) = 0 THEN
    d := replace(d, '''store_id'', p.store_id', '''store_id'', p.store_id, ''video_url'', p.video_url, ''video_poster_url'', p.video_poster_url');
    EXECUTE d;
  END IF;
END
$mig$;