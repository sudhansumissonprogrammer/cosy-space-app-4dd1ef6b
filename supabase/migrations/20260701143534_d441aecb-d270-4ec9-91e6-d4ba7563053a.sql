REVOKE EXECUTE ON FUNCTION public.get_store_sales_analytics(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_store_sales_analytics(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_store_sales_analytics(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_analytics_traffic(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_analytics_traffic(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_analytics_traffic(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone) TO authenticated;