REVOKE ALL ON FUNCTION public.get_today_analytics(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_analytics_traffic(uuid, timestamptz, timestamptz, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_today_analytics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_analytics_traffic(uuid, timestamptz, timestamptz, timestamptz, timestamptz) TO authenticated;