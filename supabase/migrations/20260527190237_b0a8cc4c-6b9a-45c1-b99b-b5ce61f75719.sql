-- Batch A: admin-only RPCs
REVOKE EXECUTE ON FUNCTION public.get_admin_analytics()           FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_stats()               FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_admin_users_stores()        FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_as_admin(text)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_wallet_summary(uuid)  FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_usage_stats()         FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dashboard_stats(uuid)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_store_billing_state(uuid)   FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_partner_audit(text,text,uuid,jsonb,jsonb,text) FROM anon;

-- Batch B: triggers (bypass EXECUTE check)
REVOKE EXECUTE ON FUNCTION public.auto_assign_new_plan_to_stores()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_plan_to_new_store()        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_partner_commission_on_paid()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_partner_self_update()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_storefront_rpc_overloads()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_whatsapp_order_customer()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.link_store_to_partner_referral()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_self_unblock()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_after_commission_insert()           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_order_commission_handler()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_subscription_payment_refund()       FROM anon, authenticated;

-- Queue / cleanup / cron (run via service_role or pg_cron superuser)
REVOKE EXECUTE ON FUNCTION public.cleanup_orphan_media_library() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_referral_telemetry()   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint)     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb)     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated;