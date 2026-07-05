REVOKE EXECUTE ON FUNCTION public.store_wa_mark_thread_read(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.store_wa_mark_thread_read(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.store_wa_mark_thread_read(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.wa_resolve_inbound_store(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.wa_resolve_inbound_store(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.wa_resolve_inbound_store(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.wa_resolve_inbound_store(text) TO service_role;