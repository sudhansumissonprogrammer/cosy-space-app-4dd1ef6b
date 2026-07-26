ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payu_txnids text[] NOT NULL DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_orders_payu_txnids ON public.orders USING gin (payu_txnids);