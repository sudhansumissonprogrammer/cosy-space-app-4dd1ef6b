ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_cod_confirm_status_chk;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_cod_confirm_status_chk
  CHECK (cod_confirm_status IS NULL OR cod_confirm_status IN ('awaiting','address_pending','confirmed','edit_requested','cancelled'));