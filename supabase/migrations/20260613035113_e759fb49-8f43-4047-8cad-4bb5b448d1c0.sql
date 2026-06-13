
-- 1) BEFORE INSERT/UPDATE on orders: auto-fill storefront_customer_id from (store_id, customer_phone)
CREATE OR REPLACE FUNCTION public.tg_orders_link_storefront_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  match_id uuid;
BEGIN
  IF NEW.storefront_customer_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.customer_phone IS NULL OR NEW.customer_phone !~ '^[6-9][0-9]{9}$' THEN
    RETURN NEW;
  END IF;
  SELECT id INTO match_id
    FROM public.storefront_customers
   WHERE store_id = NEW.store_id
     AND phone = NEW.customer_phone
   LIMIT 1;
  IF match_id IS NOT NULL THEN
    NEW.storefront_customer_id := match_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS link_storefront_customer_orders ON public.orders;
CREATE TRIGGER link_storefront_customer_orders
  BEFORE INSERT OR UPDATE OF customer_phone, storefront_customer_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_link_storefront_customer();

-- 2) AFTER INSERT/UPDATE on storefront_customers: backfill past orders for that (store, phone)
CREATE OR REPLACE FUNCTION public.tg_storefront_customers_claim_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NULL OR NEW.phone !~ '^[6-9][0-9]{9}$' THEN
    RETURN NEW;
  END IF;
  UPDATE public.orders
     SET storefront_customer_id = NEW.id
   WHERE store_id = NEW.store_id
     AND customer_phone = NEW.phone
     AND storefront_customer_id IS NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS claim_orders_storefront_customers ON public.storefront_customers;
CREATE TRIGGER claim_orders_storefront_customers
  AFTER INSERT OR UPDATE OF phone ON public.storefront_customers
  FOR EACH ROW EXECUTE FUNCTION public.tg_storefront_customers_claim_orders();

-- 3) One-time backfill for the 64 orders that already have a matching customer row.
--    (The remaining ~134 will auto-claim the next time their buyer logs in by phone,
--    via the trigger above.)
UPDATE public.orders o
   SET storefront_customer_id = s.id
  FROM public.storefront_customers s
 WHERE o.storefront_customer_id IS NULL
   AND o.customer_phone IS NOT NULL
   AND o.customer_phone ~ '^[6-9][0-9]{9}$'
   AND s.store_id = o.store_id
   AND s.phone = o.customer_phone;

-- 4) Supporting index for the trigger lookup (idempotent).
CREATE INDEX IF NOT EXISTS idx_storefront_customers_store_phone
  ON public.storefront_customers (store_id, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_store_phone_unclaimed
  ON public.orders (store_id, customer_phone)
  WHERE storefront_customer_id IS NULL AND customer_phone IS NOT NULL;
