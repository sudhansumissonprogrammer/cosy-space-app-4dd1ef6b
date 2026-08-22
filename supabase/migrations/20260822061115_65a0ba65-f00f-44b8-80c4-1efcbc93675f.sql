REVOKE EXECUTE ON FUNCTION public.get_analytics_orders_breakdown(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_analytics_funnel(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_orders_breakdown(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_analytics_funnel(uuid, timestamptz, timestamptz) TO authenticated, service_role;