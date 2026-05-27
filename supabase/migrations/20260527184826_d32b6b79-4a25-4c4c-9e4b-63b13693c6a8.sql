
-- Owner/admin-only data functions: revoke anon
REVOKE EXECUTE ON FUNCTION public.get_admin_analytics() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_users_stores() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_as_admin(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_billing_state(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_usage_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_views(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_wallet_summary(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_product_limit(uuid) FROM anon;

-- Internal trigger / queue / cron helpers: revoke anon AND authenticated
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_orphan_media_library() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_referral_telemetry() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_whatsapp_order_customer() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_partner_self_update() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_storefront_rpc_overloads() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_new_plan_to_stores() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_plan_to_new_store() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_partner_commission_on_paid() FROM anon, authenticated;
