
REVOKE EXECUTE ON FUNCTION public.wallet_apply_recharge(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_charge_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_reverse_order(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_adjust_store(uuid, text, numeric, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_set_billing_mode(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._ensure_store_wallet(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_store_commission_mode(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_store_commission_mode(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_store_wallet_summary(uuid) TO authenticated;
