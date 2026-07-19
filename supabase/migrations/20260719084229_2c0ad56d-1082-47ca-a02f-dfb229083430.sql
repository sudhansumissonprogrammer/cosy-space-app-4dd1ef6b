ALTER TABLE public.store_payment_config
  ADD COLUMN IF NOT EXISTS prepaid_discount_tier2_min NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS prepaid_discount_tier2_value NUMERIC(12,2);

COMMENT ON COLUMN public.store_payment_config.prepaid_discount_tier2_min IS 'Order value threshold (₹) at or above which the tier-2 prepaid discount replaces the base prepaid_discount_value. NULL disables tier.';
COMMENT ON COLUMN public.store_payment_config.prepaid_discount_tier2_value IS 'Tier-2 prepaid discount amount (₹). Only used when prepaid_discount_type = fixed. NULL disables tier.';