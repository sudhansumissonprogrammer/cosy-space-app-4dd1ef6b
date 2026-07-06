ALTER TABLE public.store_wallet_ledger DROP CONSTRAINT IF EXISTS store_wallet_ledger_kind_check;
ALTER TABLE public.store_wallet_ledger ADD CONSTRAINT store_wallet_ledger_kind_check
  CHECK (kind = ANY (ARRAY['recharge','order_commission','refund','admin_adjustment','wa_conversation']));