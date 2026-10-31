CREATE OR REPLACE FUNCTION public.get_store_traffic_series(_store_id uuid, _range_start timestamptz, _range_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _tz text; _raw_day date; _result jsonb;
BEGIN
 IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT COALESCE(NULLIF(timezone,''),'Asia/Kolkata') INTO _tz FROM stores WHERE id=_store_id;
 -- The oldest raw day can be incomplete after cleanup; preserve its daily rollup.
 SELECT (min(created_at) AT TIME ZONE _tz)::date INTO _raw_day FROM page_views WHERE store_id=_store_id;
 WITH daily AS (
 SELECT date,sessions::bigint sessions,visitors::bigint visitors,pageviews::bigint pageviews,'rollup'::text source
 FROM page_views_daily WHERE store_id=_store_id AND date>=(_range_start AT TIME ZONE _tz)::date AND date<=(_range_end AT TIME ZONE _tz)::date
 ), raw AS (
 SELECT (created_at AT TIME ZONE _tz)::date date,
 count(DISTINCT COALESCE(NULLIF(session_id,''),NULLIF(visitor_id,''))) sessions,
 count(DISTINCT COALESCE(NULLIF(visitor_id,''),NULLIF(session_id,''))) visitors,count(*) pageviews,'raw'::text source
 FROM page_views WHERE store_id=_store_id AND created_at>=_range_start AND created_at<=_range_end AND NOT COALESCE(is_bot,false)
 GROUP BY 1
 ), combined AS (
 SELECT COALESCE(r.date,d.date) date,
 CASE WHEN d.date IS NOT NULL AND (r.date IS NULL OR d.date<=_raw_day) THEN d.sessions ELSE r.sessions END sessions,
 CASE WHEN d.date IS NOT NULL AND (r.date IS NULL OR d.date<=_raw_day) THEN d.visitors ELSE r.visitors END visitors,
 CASE WHEN d.date IS NOT NULL AND (r.date IS NULL OR d.date<=_raw_day) THEN d.pageviews ELSE r.pageviews END pageviews,
 CASE WHEN d.date IS NOT NULL AND (r.date IS NULL OR d.date<=_raw_day) THEN 'rollup' ELSE 'raw' END source
 FROM daily d FULL JOIN raw r USING(date)
 ) SELECT COALESCE(jsonb_agg(to_jsonb(combined) ORDER BY date),'[]'::jsonb) INTO _result FROM combined;
 RETURN _result;
END $$;
REVOKE ALL ON FUNCTION public.get_store_traffic_series(uuid,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_store_traffic_series(uuid,timestamptz,timestamptz) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_analytics_traffic(_store_id uuid,_range_start timestamptz,_range_end timestamptz,_prior_start timestamptz,_prior_end timestamptz)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _s bigint:=0; _v bigint:=0; _ps bigint:=0; _pv bigint:=0; _p bigint:=0; _pp bigint:=0; _series jsonb; _prior jsonb; _mode text;
BEGIN
 IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 _series:=public.get_store_traffic_series(_store_id,_range_start,_range_end);
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_series) j WHERE j->>'source'='rollup') THEN
  SELECT COALESCE(sum((j->>'sessions')::bigint),0),COALESCE(sum((j->>'visitors')::bigint),0),COALESCE(sum((j->>'pageviews')::bigint),0) INTO _s,_v,_p FROM jsonb_array_elements(_series) j;
  _mode:='daily_aggregates';
 ELSE
  SELECT count(DISTINCT COALESCE(NULLIF(session_id,''),NULLIF(visitor_id,''))),count(DISTINCT COALESCE(NULLIF(visitor_id,''),NULLIF(session_id,''))),count(*) INTO _s,_v,_p FROM page_views WHERE store_id=_store_id AND created_at>=_range_start AND created_at<=_range_end AND NOT COALESCE(is_bot,false);
  _mode:='distinct';
 END IF;
 IF _prior_end>_prior_start THEN
  _prior:=public.get_store_traffic_series(_store_id,_prior_start,_prior_end-interval '1 microsecond');
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(_prior) j WHERE j->>'source'='rollup') THEN
   SELECT COALESCE(sum((j->>'sessions')::bigint),0),COALESCE(sum((j->>'visitors')::bigint),0),COALESCE(sum((j->>'pageviews')::bigint),0) INTO _ps,_pv,_pp FROM jsonb_array_elements(_prior) j;
  ELSE
   SELECT count(DISTINCT COALESCE(NULLIF(session_id,''),NULLIF(visitor_id,''))),count(DISTINCT COALESCE(NULLIF(visitor_id,''),NULLIF(session_id,''))),count(*) INTO _ps,_pv,_pp FROM page_views WHERE store_id=_store_id AND created_at>=_prior_start AND created_at<_prior_end AND NOT COALESCE(is_bot,false);
  END IF;
 END IF;
 RETURN jsonb_build_object('sessions',_s,'visitors',_v,'pageviews',_p,'prior_sessions',_ps,'prior_visitors',_pv,'prior_pageviews',_pp,'measurement',_mode);
END $$;
REVOKE ALL ON FUNCTION public.get_analytics_traffic(uuid,timestamptz,timestamptz,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_traffic(uuid,timestamptz,timestamptz,timestamptz,timestamptz) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.get_store_live_view(_store_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE _live jsonb; _behavior jsonb; _locations jsonb; _countries jsonb; _purchases bigint; _sales numeric;
BEGIN
 IF NOT (public.is_store_owner(_store_id) OR public.has_role(auth.uid(),'admin'::public.app_role)) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 _live:=get_live_visitors(_store_id);
 WITH sessions AS (
 SELECT session_id, bool_or(event_name='add_to_cart') cart, bool_or(event_name='begin_checkout') checkout
 FROM storefront_events WHERE store_id=_store_id AND created_at>=now()-interval '10 minutes' AND NULLIF(session_id,'') IS NOT NULL GROUP BY session_id
 ) SELECT jsonb_build_object('cart_sessions',count(*) FILTER(WHERE cart),'checkout_sessions',count(*) FILTER(WHERE checkout)) INTO _behavior FROM sessions;
 SELECT count(*),COALESCE(sum(total),0) INTO _purchases,_sales FROM orders WHERE store_id=_store_id AND created_at>=now()-interval '10 minutes' AND status IN ('confirmed','shipped','delivered','partially_paid','paid','completed') AND NOT COALESCE(is_migrated,false);
 SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.orders DESC),'[]'::jsonb) INTO _locations FROM (
 SELECT NULLIF(trim(city),'') city,NULLIF(trim(state),'') state,count(*) orders,max(created_at) latest
 FROM orders WHERE store_id=_store_id AND created_at>=now()-interval '24 hours' AND status IN ('confirmed','shipped','delivered','partially_paid','paid','completed') AND NOT COALESCE(is_migrated,false)
 GROUP BY 1,2 ORDER BY count(*) DESC LIMIT 200
 ) t;
 WITH countries AS (
 SELECT DISTINCT ON (l.session_id) l.session_id,p.country
 FROM live_sessions l JOIN page_views p ON p.store_id=l.store_id AND p.session_id=l.session_id
 WHERE l.store_id=_store_id AND l.last_seen>=now()-interval '90 seconds' AND p.created_at>=now()-interval '1 day' AND NOT COALESCE(p.is_bot,false)
 ORDER BY l.session_id,p.created_at DESC
 ) SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO _countries FROM (SELECT country,count(*) visitors FROM countries GROUP BY country) t;
 RETURN jsonb_build_object('live',_live,'behavior',_behavior,'purchases',_purchases,'sales',_sales,'order_locations',_locations,'visitor_countries',_countries,'updated_at',now());
END $$;
REVOKE ALL ON FUNCTION public.get_store_live_view(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_store_live_view(uuid) TO authenticated,service_role;
