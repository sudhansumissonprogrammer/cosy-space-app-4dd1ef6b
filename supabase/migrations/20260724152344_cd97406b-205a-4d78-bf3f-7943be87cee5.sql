-- Enable Cashfree in imitationworld's payment_methods so UPI intent tiles
-- have a working S2S gateway (their PayU merchant account is not S2S-approved,
-- causing every create-upi-intent call to fail with "UPI apps unavailable").
-- Cashfree credentials are already stored on this row.
UPDATE public.store_payment_config
SET payment_methods = '["cod","cashfree","payu"]'::jsonb,
    updated_at = now()
WHERE store_id = (SELECT id FROM public.stores WHERE slug = 'imitationworld');