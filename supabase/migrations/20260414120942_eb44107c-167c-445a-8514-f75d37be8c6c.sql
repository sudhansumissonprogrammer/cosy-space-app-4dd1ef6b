GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON TABLE public.stores TO authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.stores TO authenticated;