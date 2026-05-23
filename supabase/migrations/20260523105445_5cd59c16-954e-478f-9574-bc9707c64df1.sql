ALTER VIEW public.stores_public SET (security_invoker = false);
GRANT SELECT ON public.stores_public TO anon, authenticated;