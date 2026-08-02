-- STAGING ONLY — gate that must pass before any destructive load test runs.
-- Every count below must be 0. Any non-zero value is a hard blocker.
\echo '=== 1. real-looking phone numbers still present? (must be 0) ==='
SELECT count(*) AS leaked_order_phones FROM orders
WHERE customer_phone IS NOT NULL AND customer_phone NOT LIKE '90000%';

SELECT count(*) AS leaked_customer_phones FROM customers
WHERE phone IS NOT NULL AND phone NOT LIKE '90000%';

\echo '=== 2. live ad-tracking credentials still present? (must be 0) ==='
SELECT count(*) AS live_tracking FROM stores
WHERE facebook_pixel_id IS NOT NULL OR meta_access_token IS NOT NULL OR capi_disabled IS NOT TRUE;

\echo '=== 3. Meta attribution signals still replayable? (must be 0) ==='
SELECT count(*) AS attributable_orders FROM orders
WHERE buyer_fbc IS NOT NULL OR buyer_fbp IS NOT NULL OR buyer_ip IS NOT NULL;

\echo '=== 4. live payment credentials still present? (must be 0) ==='
SELECT count(*) AS live_pay FROM store_payment_config
WHERE razorpay_key_secret IS NOT NULL OR payu_merchant_salt IS NOT NULL
   OR cashfree_secret_key IS NOT NULL OR cashfree_env <> 'sandbox' OR payu_env <> 'test';

\echo '=== 5. outbound channels enabled? (must be 0) ==='
SELECT
  (SELECT count(*) FROM stores_wa_settings
     WHERE platform_marketing_enabled OR send_abandoned_cart
        OR send_order_confirmation OR send_order_shipped)  AS wa_toggles_on,
  (SELECT count(*) FROM whatsapp_config WHERE is_active)   AS wa_cfg_on,
  (SELECT count(*) FROM platform_wa_templates WHERE is_active) AS templates_on,
  (SELECT count(*) FROM wa_send_queue)                     AS queued,
  (SELECT count(*) FROM push_subscriptions)                AS push_subs,
  (SELECT count(*) FROM email_send_state)                  AS email_state;

\echo '=== 6. custom domains still pointing at prod? (must be 0) ==='
SELECT count(*) AS domains FROM stores WHERE custom_domain IS NOT NULL OR domain_verified;
