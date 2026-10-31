CREATE OR REPLACE FUNCTION public.cleanup_app_logs() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _el_deleted int; _cl_deleted int;
BEGIN
 -- Analytics retention belongs to cleanup_old_analytics; never overwrite full daily rollups with partial UTC days.
 WITH d AS (DELETE FROM public.error_logs WHERE created_at<now()-interval '30 days' RETURNING 1) SELECT count(*) INTO _el_deleted FROM d;
 WITH d AS (DELETE FROM public.customer_leads WHERE created_at<now()-interval '180 days' RETURNING 1) SELECT count(*) INTO _cl_deleted FROM d;
 RETURN json_build_object('error_logs_deleted',_el_deleted,'customer_leads_deleted',_cl_deleted,'ran_at',now());
END $$;
CREATE OR REPLACE FUNCTION public.rollup_page_views_daily(target_date date DEFAULT (CURRENT_DATE - 1)) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE rows_written integer:=0;
BEGIN
 WITH base AS (
 SELECT pv.store_id,(pv.created_at AT TIME ZONE COALESCE(NULLIF(s.timezone,''),'Asia/Kolkata'))::date local_date,pv.created_at,
 COALESCE(NULLIF(pv.session_id,''),NULLIF(pv.visitor_id,'')) sk,COALESCE(NULLIF(pv.visitor_id,''),NULLIF(pv.session_id,'')) vk,COALESCE(pv.is_bot,false) is_bot
 FROM page_views pv JOIN stores s ON s.id=pv.store_id WHERE pv.created_at>=(target_date-1)::timestamptz AND pv.created_at<(target_date+2)::timestamptz
 ), filtered AS (SELECT * FROM base WHERE local_date=target_date), sess AS (
 SELECT store_id,sk,count(*) hits,EXTRACT(EPOCH FROM max(created_at)-min(created_at))::bigint dur FROM filtered WHERE NOT is_bot AND sk IS NOT NULL GROUP BY store_id,sk
 ), agg AS (
 SELECT f.store_id,target_date date,count(*) FILTER(WHERE NOT is_bot)::int pageviews,count(DISTINCT sk) FILTER(WHERE NOT is_bot)::int sessions,count(DISTINCT vk) FILTER(WHERE NOT is_bot)::int visitors,count(*) FILTER(WHERE is_bot)::int bot_views,
 COALESCE((SELECT count(*) FROM sess WHERE sess.store_id=f.store_id AND hits=1),0)::int bounce_sessions,COALESCE((SELECT sum(dur) FROM sess WHERE sess.store_id=f.store_id),0)::bigint total_session_duration_seconds
 FROM filtered f GROUP BY f.store_id
 ), ups AS (
 INSERT INTO page_views_daily(store_id,date,pageviews,sessions,visitors,bot_views,bounce_sessions,total_session_duration_seconds)
 SELECT store_id,date,pageviews,sessions,visitors,bot_views,bounce_sessions,total_session_duration_seconds FROM agg
 ON CONFLICT(store_id,date) DO UPDATE SET pageviews=EXCLUDED.pageviews,sessions=EXCLUDED.sessions,visitors=EXCLUDED.visitors,bot_views=EXCLUDED.bot_views,bounce_sessions=EXCLUDED.bounce_sessions,total_session_duration_seconds=EXCLUDED.total_session_duration_seconds RETURNING 1
 ) SELECT count(*) INTO rows_written FROM ups;
 RETURN rows_written;
END $$;
REVOKE ALL ON FUNCTION public.cleanup_app_logs() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_app_logs() TO service_role;
REVOKE ALL ON FUNCTION public.rollup_page_views_daily(date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rollup_page_views_daily(date) TO service_role;