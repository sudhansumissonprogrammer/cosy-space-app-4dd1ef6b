-- Admin RPCs: revoke from PUBLIC, re-grant to authenticated only
-- (internal has_role() check still gates admin-only access)
DO $$
DECLARE
  fn text;
  admin_fns text[] := ARRAY[
    'get_admin_analytics()',
    'get_admin_stats()',
    'get_admin_users_stores()',
    'get_store_as_admin(text)',
    'get_store_wallet_summary(uuid)',
    'get_store_usage_stats()',
    'get_dashboard_stats(uuid)',
    'get_store_billing_state(uuid)',
    'log_partner_audit(text,text,uuid,jsonb,jsonb,text)'
  ];
BEGIN
  FOREACH fn IN ARRAY admin_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT  EXECUTE ON FUNCTION public.%s TO authenticated', fn);
  END LOOP;
END $$;

-- Trigger/queue/cron functions: revoke from PUBLIC (service_role still works — it bypasses checks)
DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    'auto_assign_new_plan_to_stores()',
    'auto_assign_plan_to_new_store()',
    'create_partner_commission_on_paid()',
    'guard_partner_self_update()',
    'guard_storefront_rpc_overloads()',
    'handle_new_user()',
    'handle_whatsapp_order_customer()',
    'link_store_to_partner_referral()',
    'prevent_self_unblock()',
    'tg_after_commission_insert()',
    'tg_order_commission_handler()',
    'tg_subscription_payment_refund()',
    'cleanup_orphan_media_library()',
    'cleanup_referral_telemetry()',
    'delete_email(text,bigint)',
    'enqueue_email(text,jsonb)',
    'move_to_dlq(text,text,bigint,jsonb)'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;