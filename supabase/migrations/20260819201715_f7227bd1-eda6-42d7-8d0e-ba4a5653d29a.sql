REVOKE ALL ON FUNCTION public.get_store_monthly_sales(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_products_page(uuid, text, text, text, text[], text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_store_monthly_sales(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_products_page(uuid, text, text, text, text[], text, integer, integer) TO authenticated, service_role;
