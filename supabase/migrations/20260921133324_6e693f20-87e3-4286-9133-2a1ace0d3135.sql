REVOKE ALL ON FUNCTION public.get_storefront_categories(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_categories(uuid) TO anon, authenticated, service_role;