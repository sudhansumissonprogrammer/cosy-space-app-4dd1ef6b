ALTER TABLE public.store_commission_config ALTER COLUMN min_recharge SET DEFAULT 600;
UPDATE public.store_commission_config SET min_recharge = 600 WHERE min_recharge <> 600;