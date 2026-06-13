
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
  COALESCE(ord.last_order_at, sc.created_at) AS updated_at,
  COALESCE(ord.order_count, 0)::int   AS order_count,
  COALESCE(ord.total_spent, 0)::numeric AS total_spent,
  'storefront'::text AS source
FROM public.storefront_customers sc
LEFT JOIN LATERAL (
  SELECT count(*)::int AS order_count,
         COALESCE(sum(total), 0)::numeric AS total_spent,
         max(created_at) AS last_order_at
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
  c.updated_at,
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
