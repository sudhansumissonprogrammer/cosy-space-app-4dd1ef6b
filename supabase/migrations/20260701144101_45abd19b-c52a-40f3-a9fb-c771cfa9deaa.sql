CREATE OR REPLACE FUNCTION public.get_analytics_breakdowns(
  _store_id uuid,
  _range_start timestamp with time zone,
  _range_end timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _top_pages jsonb := '[]'::jsonb;
  _sources jsonb := '[]'::jsonb;
  _countries jsonb := '[]'::jsonb;
  _devices jsonb := '[]'::jsonb;
BEGIN
  IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('path', p.path, 'views', p.views) ORDER BY p.views DESC), '[]'::jsonb)
    INTO _top_pages
  FROM (
    SELECT COALESCE(NULLIF(path, ''), '/') AS path, COUNT(*)::bigint AS views
    FROM public.page_views
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
      AND COALESCE(is_bot, false) = false
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  ) p;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', s.name, 'value', s.value) ORDER BY s.value DESC), '[]'::jsonb)
    INTO _sources
  FROM (
    SELECT
      CASE
        WHEN NULLIF(utm_source, '') IS NOT NULL THEN lower(utm_source)
        WHEN referrer IS NULL OR referrer = '' THEN 'direct'
        WHEN lower(referrer) ~ 'google\\.' THEN 'google'
        WHEN lower(referrer) ~ 'facebook\\.|fb\\.' THEN 'facebook'
        WHEN lower(referrer) ~ 'instagram\\.' THEN 'instagram'
        WHEN lower(referrer) ~ 'youtube\\.' THEN 'youtube'
        WHEN lower(referrer) ~ 'whatsapp\\.|wa\\.me' THEN 'whatsapp'
        WHEN lower(referrer) ~ 'bing\\.' THEN 'bing'
        WHEN lower(referrer) ~ 't\\.co|twitter\\.|x\\.com' THEN 'twitter'
        ELSE COALESCE(NULLIF(regexp_replace(lower(referrer), '^https?://(www\\.)?([^/:?#]+).*$','\\2'), ''), 'referral')
      END AS name,
      COUNT(*)::bigint AS value
    FROM public.page_views
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
      AND COALESCE(is_bot, false) = false
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 8
  ) s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', c.name, 'value', c.value) ORDER BY c.value DESC), '[]'::jsonb)
    INTO _countries
  FROM (
    SELECT upper(COALESCE(NULLIF(country, ''), 'Unknown')) AS name, COUNT(*)::bigint AS value
    FROM public.page_views
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
      AND COALESCE(is_bot, false) = false
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 10
  ) c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('name', d.name, 'value', d.value) ORDER BY d.value DESC), '[]'::jsonb)
    INTO _devices
  FROM (
    SELECT lower(COALESCE(NULLIF(device, ''), 'unknown')) AS name, COUNT(*)::bigint AS value
    FROM public.page_views
    WHERE store_id = _store_id
      AND created_at >= _range_start
      AND created_at <= _range_end
      AND COALESCE(is_bot, false) = false
    GROUP BY 1
    ORDER BY 2 DESC
  ) d;

  RETURN jsonb_build_object(
    'top_pages', COALESCE(_top_pages, '[]'::jsonb),
    'sources', COALESCE(_sources, '[]'::jsonb),
    'countries', COALESCE(_countries, '[]'::jsonb),
    'devices', COALESCE(_devices, '[]'::jsonb)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_analytics_breakdowns(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_analytics_breakdowns(uuid, timestamp with time zone, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_breakdowns(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;