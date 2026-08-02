-- STAGING ONLY — gate that must pass before any destructive load test runs.
-- Any row returned here is a blocker.
\echo '=== real-looking phone numbers still present? (must be 0) ==='
SELECT count(*) AS leaked_phones FROM orders
WHERE customer_phone IS NOT NULL AND customer_phone NOT LIKE '90000%';

\echo '=== live tracking credentials still present? (must be 0) ==='
SELECT count(*) AS live_pixels FROM stores
WHERE meta_pixel_id IS NOT NULL OR meta_access_token IS NOT NULL OR ga4_measurement_id IS NOT NULL;

\echo '=== live payment credentials still present? (must be 0) ==='
SELECT count(*) AS live_pay FROM store_payment_config
WHERE is_live IS TRUE OR razorpay_key_secret IS NOT NULL OR payu_salt IS NOT NULL
   OR cashfree_secret_key IS NOT NULL;

\echo '=== outbound channels enabled? (must be 0) ==='
SELECT
  (SELECT count(*) FROM stores_wa_settings WHERE marketing_enabled OR transactional_enabled) AS wa_on,
  (SELECT count(*) FROM whatsapp_config WHERE is_active) AS wa_cfg_on,
  (SELECT count(*) FROM wa_send_queue) AS queued,
  (SELECT count(*) FROM push_subscriptions) AS push_subs;

\echo '=== custom domains pointing at prod? (must be 0) ==='
SELECT count(*) AS domains FROM stores WHERE custom_domain IS NOT NULL;
