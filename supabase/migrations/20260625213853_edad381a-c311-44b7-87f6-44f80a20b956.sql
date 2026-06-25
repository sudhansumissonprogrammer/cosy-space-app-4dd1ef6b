
-- ============================================================
-- BATCH 2 SECURITY: atomic coupon claim, dedupe policies, FORCE RLS on financial tables
-- ============================================================

-- C5: Atomic coupon claim RPC (prevents race condition on max_uses)
CREATE OR REPLACE FUNCTION public.claim_coupon(_coupon_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rows int;
BEGIN
  UPDATE public.coupons
  SET used_count = used_count + 1
  WHERE id = _coupon_id
    AND store_id = _store_id
    AND is_active = true
    AND starts_at <= now()
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR used_count < max_uses);
  GET DIAGNOSTICS _rows = ROW_COUNT;
  RETURN _rows = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_coupon(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_coupon(uuid, uuid) TO service_role;

-- H6: Dedupe overlapping subscription_payments policies
DROP POLICY IF EXISTS "Admins manage payments" ON public.subscription_payments;
DROP POLICY IF EXISTS "Store owner views own payments" ON public.subscription_payments;
-- Keep: "Admins can manage subscription payments" (ALL) and "Store owners can view own payments" (SELECT)

-- H9: FORCE ROW LEVEL SECURITY on financial/sensitive tables
-- service_role has BYPASSRLS so edge functions still work; this blocks any
-- definer function or trigger inadvertently running as table owner from skipping RLS.
ALTER TABLE public.orders                    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.order_items               FORCE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_payments     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.partner_wallets           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.partner_wallet_ledger     FORCE ROW LEVEL SECURITY;
ALTER TABLE public.partner_withdrawals       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commissions       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_wallets             FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_wallet_ledger       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_wallet_recharges    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_commissions   FORCE ROW LEVEL SECURITY;
ALTER TABLE public.coupons                   FORCE ROW LEVEL SECURITY;
