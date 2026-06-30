UPDATE public.stores
SET order_mode = 'website'
WHERE order_mode IS DISTINCT FROM 'website';

ALTER TABLE public.stores ALTER COLUMN order_mode SET DEFAULT 'website';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stores_order_mode_commission_only_check'
      AND conrelid = 'public.stores'::regclass
  ) THEN
    ALTER TABLE public.stores DROP CONSTRAINT stores_order_mode_commission_only_check;
  END IF;
END $$;

ALTER TABLE public.stores
  ADD CONSTRAINT stores_order_mode_commission_only_check CHECK (order_mode = 'website');