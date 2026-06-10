
-- 1) Drop redundant / unused indexes (safe: IF EXISTS)
DROP INDEX IF EXISTS public.idx_page_views_store_recent;
DROP INDEX IF EXISTS public.idx_page_views_store_session;

-- 2) Add missing store_id indexes (IF NOT EXISTS — idempotent, safe)
CREATE INDEX IF NOT EXISTS idx_storefront_customers_store
  ON public.storefront_customers (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_notifications_store
  ON public.store_notifications (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_scheduled_store
  ON public.whatsapp_scheduled (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_bulk_campaigns_store
  ON public.whatsapp_bulk_campaigns (store_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_commissions_store
  ON public.partner_commissions (store_id, created_at DESC)
  WHERE store_id IS NOT NULL;

-- 3) Batched reorder RPC — replaces N UPDATE round-trips with one call
DROP FUNCTION IF EXISTS public.reorder_products(uuid[]);

CREATE OR REPLACE FUNCTION public.reorder_products(_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _store uuid;
  _mismatch int;
BEGIN
  IF _ids IS NULL OR array_length(_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT store_id INTO _store FROM public.products WHERE id = _ids[1];
  IF _store IS NULL THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  IF NOT (public.is_store_owner(_store) OR public.has_role(auth.uid(), 'admin'::public.app_role)) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT count(*) INTO _mismatch
  FROM public.products
  WHERE id = ANY(_ids) AND store_id <> _store;
  IF _mismatch > 0 THEN
    RAISE EXCEPTION 'cross-store reorder not allowed';
  END IF;

  UPDATE public.products p
  SET display_order = pos.ord,
      updated_at = now()
  FROM (
    SELECT unnest(_ids) AS id,
           generate_subscripts(_ids, 1) AS ord
  ) pos
  WHERE p.id = pos.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reorder_products(uuid[]) TO authenticated;
