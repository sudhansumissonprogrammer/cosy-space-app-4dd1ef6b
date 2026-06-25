
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.customer_leads;
CREATE POLICY "Anyone can insert leads"
ON public.customer_leads
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = customer_leads.store_id
      AND coalesce(s.is_suspended, false) = false
  )
  AND char_length(coalesce(name, '')) <= 200
  AND char_length(coalesce(phone, '')) <= 30
  AND char_length(coalesce(product_name, '')) <= 300
);

REVOKE SELECT ON public.platform_config FROM anon, authenticated;
DROP POLICY IF EXISTS "Authenticated can view platform config" ON public.platform_config;

DROP VIEW IF EXISTS public.platform_config_public;
CREATE VIEW public.platform_config_public
WITH (security_invoker = true) AS
SELECT id, platform_name, default_currency, wa_business_phone, updated_at
FROM public.platform_config;
GRANT SELECT ON public.platform_config_public TO anon, authenticated;

DROP POLICY IF EXISTS "Storefront customers can cancel own orders" ON public.orders;

CREATE OR REPLACE FUNCTION public.cancel_own_order(_order_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owns boolean;
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT o.status,
         EXISTS (SELECT 1 FROM public.storefront_customers sc
                 WHERE sc.id = o.storefront_customer_id AND sc.user_id = v_uid)
    INTO v_status, v_owns
  FROM public.orders o
  WHERE o.id = _order_id;

  IF NOT FOUND OR NOT v_owns THEN
    RAISE EXCEPTION 'not_found_or_forbidden';
  END IF;

  IF v_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'cannot_cancel_in_status_%', v_status;
  END IF;

  UPDATE public.orders
  SET status = 'cancelled',
      notes  = COALESCE(notes, '') ||
               E'\n[Cancelled by customer]' ||
               CASE WHEN _reason IS NOT NULL AND length(_reason) > 0
                    THEN ' Reason: ' || left(_reason, 500)
                    ELSE '' END
  WHERE id = _order_id;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.cancel_own_order(uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.cancel_own_order(uuid, text) TO authenticated;

REVOKE SELECT (owner_email, meta_access_token, domain_verification_token,
               suspension_reason, default_profit_margin, referred_by_partner_id)
ON public.stores FROM anon, authenticated;
