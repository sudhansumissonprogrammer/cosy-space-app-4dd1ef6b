
-- 1) Deduplicate any existing (user_id, store_id) pairs before adding the unique index.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, store_id
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.storefront_customers
  WHERE user_id IS NOT NULL AND store_id IS NOT NULL
)
DELETE FROM public.storefront_customers sc
USING ranked r
WHERE sc.id = r.id AND r.rn > 1;

-- 2) Unique index — blocks the race between phone-login and create-guest-account.
CREATE UNIQUE INDEX IF NOT EXISTS storefront_customers_user_store_uidx
  ON public.storefront_customers (user_id, store_id);

-- 3) Unified merchant view. security_invoker = on so existing RLS on the underlying
--    tables (storefront_customers + customers) applies to the caller.
DROP VIEW IF EXISTS public.merchant_customers_v;
CREATE VIEW public.merchant_customers_v
WITH (security_invoker = on) AS
SELECT
  sc.id,
  sc.store_id,
  sc.name,
  sc.phone,
  sc.email,
  sc.created_at,
  COALESCE(ord.order_count, 0)::int   AS order_count,
  COALESCE(ord.total_spent, 0)::numeric AS total_spent,
  'storefront'::text AS source
FROM public.storefront_customers sc
LEFT JOIN LATERAL (
  SELECT count(*)::int AS order_count,
         COALESCE(sum(total), 0)::numeric AS total_spent
  FROM public.orders o
  WHERE o.storefront_customer_id = sc.id
) ord ON true
UNION ALL
SELECT
  c.id,
  c.store_id,
  c.name,
  c.phone,
  c.email,
  c.created_at,
  c.order_count,
  0::numeric AS total_spent,
  'whatsapp'::text AS source
FROM public.customers c
WHERE NOT EXISTS (
  SELECT 1 FROM public.storefront_customers sc2
  WHERE sc2.store_id = c.store_id
    AND sc2.phone IS NOT NULL
    AND sc2.phone = c.phone
);

GRANT SELECT ON public.merchant_customers_v TO authenticated;
GRANT SELECT ON public.merchant_customers_v TO service_role;
