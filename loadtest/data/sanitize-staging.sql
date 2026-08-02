-- STAGING ONLY — sanitize a production clone before any test traffic.
-- Run IMMEDIATELY after restoring the prod dump into staging, before the
-- staging app is pointed at it. It destroys PII and neutralises every outbound
-- channel so a load test can never message, charge, or email a real person.
--
--   psql "$STAGING_DATABASE_URL" -f loadtest/data/sanitize-staging.sql
--
-- Column names verified against the live schema on 2026-08-02.
DO $$
BEGIN
  IF current_database() !~* '(staging|stage|test|clone)' THEN
    RAISE EXCEPTION 'Refusing to sanitize: database "%" does not look like staging', current_database();
  END IF;
END $$;

BEGIN;

-- 1. Customer PII ------------------------------------------------------------
UPDATE orders SET
  customer_name  = 'Test Customer ' || left(md5(id::text), 6),
  customer_phone = '90000' || lpad((abs(hashtext(id::text)) % 100000)::text, 5, '0'),
  buyer_email    = 'redacted+' || left(md5(id::text), 8) || '@example.invalid',
  street_address = 'Sanitized address',
  city           = 'Testville',
  notes          = NULL,
  -- Meta attribution signals: remove so nothing can be replayed to CAPI.
  buyer_ip = NULL, buyer_fbc = NULL, buyer_fbp = NULL,
  buyer_user_agent = NULL, buyer_external_id = NULL,
  meta_event_id = NULL, meta_event_source_url = NULL;

UPDATE customers SET
  name  = 'Test Customer ' || left(md5(id::text), 6),
  phone = '90000' || lpad((abs(hashtext(id::text)) % 100000)::text, 5, '0'),
  email = 'redacted+' || left(md5(id::text), 8) || '@example.invalid',
  address = 'Sanitized address';

UPDATE customer_addresses SET
  full_name = 'Test Customer',
  phone = '9000000000',
  street_address = 'Sanitized address';

UPDATE storefront_customers SET
  name  = 'Test Customer',
  phone = '90000' || lpad((abs(hashtext(id::text)) % 100000)::text, 5, '0'),
  email = 'redacted+' || left(md5(id::text), 8) || '@example.invalid';

UPDATE customer_leads  SET phone = '9000000000', name = 'Test Lead';
UPDATE landing_leads   SET phone = '9000000000', name = 'Test Lead',
                           user_agent = NULL, referrer = NULL;
UPDATE abandoned_carts SET customer_phone = '9000000000', customer_email = NULL;
UPDATE profiles        SET full_name = 'Test User';

-- 2. Kill every outbound channel + all ad tracking ---------------------------
UPDATE stores SET
  facebook_pixel_id = NULL,
  meta_access_token = NULL,
  capi_disabled     = true,
  whatsapp_number   = '9000000000',
  secondary_phone   = NULL,
  owner_email       = 'redacted@example.invalid',
  custom_domain     = NULL,
  domain_verified   = false;

UPDATE stores_wa_settings SET
  platform_marketing_enabled = false,
  send_abandoned_cart        = false,
  send_order_confirmation    = false,
  send_order_shipped         = false;

UPDATE whatsapp_config        SET is_active = false, access_token = NULL;
UPDATE platform_wa_templates  SET is_active = false, paused = true;
DELETE FROM wa_send_queue;
DELETE FROM whatsapp_scheduled;
DELETE FROM push_subscriptions;
DELETE FROM email_send_state;
DELETE FROM email_send_log;

-- 3. Payment credentials — sandbox or nothing --------------------------------
UPDATE store_payment_config SET
  razorpay_key_id = NULL, razorpay_key_secret = NULL,
  cashfree_app_id = NULL, cashfree_secret_key = NULL, cashfree_env = 'sandbox',
  payu_merchant_key = NULL, payu_merchant_salt = NULL, payu_env = 'test';

-- 4. Trim heavy analytics so the clone is cheap to restore and fast to test ---
DELETE FROM page_views        WHERE created_at < now() - interval '7 days';
DELETE FROM storefront_events WHERE created_at < now() - interval '7 days';
DELETE FROM error_logs;
DELETE FROM partner_audit_logs;
DELETE FROM stores_tracking_audit;

COMMIT;

ANALYZE;

\echo 'Sanitization complete. Now run loadtest/data/verify-sanitized.sql — it must report all zeros.'
