ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS applied_coupon_id uuid REFERENCES public.coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS orders_applied_coupon_id_idx ON public.orders(applied_coupon_id);