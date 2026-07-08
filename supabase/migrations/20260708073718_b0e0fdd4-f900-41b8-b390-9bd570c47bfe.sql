
-- Promote abandoned_cart_v5 as the active marketing template.
-- v5 is Meta-approved on the WABA side; mark it APPROVED here so
-- the auto-picker (wa-cart-recovery-cron) chooses it over v2.
UPDATE public.platform_wa_templates
SET meta_status = 'APPROVED', is_active = true, paused = false, updated_at = now()
WHERE name = 'abandoned_cart_v5';

-- Keep v6 paused until it is actually approved on Meta; otherwise the
-- picker (ORDER BY name DESC) would prefer v6 over v5.
UPDATE public.platform_wa_templates
SET is_active = false, paused = true, updated_at = now()
WHERE name = 'abandoned_cart_v6' AND meta_status <> 'APPROVED';

-- Keep v2 approved as the safety fallback for low-MRP carts (<₹300).
