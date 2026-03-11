
-- 1. FIX CRITICAL: Remove anon SELECT that exposes razorpay_key_secret
DROP POLICY IF EXISTS "Public can view payment methods" ON public.store_payment_config;

-- Create a public view hiding secrets
CREATE OR REPLACE VIEW public.store_payment_config_public
WITH (security_invoker = on) AS
SELECT id, store_id, payment_methods, razorpay_key_id, created_at, updated_at
FROM public.store_payment_config;

-- 2. Tighten order INSERT: require valid non-suspended store
DROP POLICY IF EXISTS "Anyone can create website orders" ON public.orders;
CREATE POLICY "Anyone can create website orders"
ON public.orders FOR INSERT
TO public
WITH CHECK (
  EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND is_suspended = false)
);

-- Tighten order_items INSERT: require valid order
DROP POLICY IF EXISTS "Anyone can create website order items" ON public.order_items;
CREATE POLICY "Anyone can create website order items"
ON public.order_items FOR INSERT
TO public
WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id)
);
