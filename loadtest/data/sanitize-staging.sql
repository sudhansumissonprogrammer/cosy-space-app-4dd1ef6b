-- STAGING ONLY — sanitize a production clone before any test traffic.
-- Run this IMMEDIATELY after restoring the prod dump into staging, before the
-- staging app is pointed at it. It destroys PII and neutralises every outbound
-- channel so a load test can never message, charge, or email a real person.
--
--   psql "$STAGING_DATABASE_URL" -f loadtest/data/sanitize-staging.sql
--
-- Refuses to run if it detects a production-looking database name.
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
  customer_email = 'redacted+' || left(md5(id::text), 8) || '@example.invalid',
  customer_address = 'Sanitized address',
  customer_city = 'Testville',
  notes = NULL;

UPDATE customers SET
  name  = 'Test Customer ' || left(md5(id::text), 6),
  phone = '90000' || lpad((abs(hashtext(id::text)) % 100000)::text, 5, '0'),
  email = 'redacted+' || left(md5(id::text), 8) || '@example.invalid';

UPDATE customer_addresses SET
  full_name = 'Test Customer',
  phone = '9000000000',
  address_line1 = 'Sanitized', address_line2 = NULL;

UPDATE storefront_customers SET
  phone = '90000' || lpad((abs(hashtext(id::text)) % 100000)::text, 5, '0');

UPDATE customer_leads SET phone = '9000000000', name = 'Test Lead';
UPDATE landing_leads SET phone = '9000000000', email = 'redacted@example.invalid';
UPDATE abandoned_carts SET customer_phone = '9000000000', customer_email = NULL;
UPDATE profiles SET full_name = 'Test User';

-- 2. Kill every outbound channel ---------------------------------------------
UPDATE stores SET
  meta_pixel_id = NULL,
  meta_access_token = NULL,
  ga4_measurement_id = NULL,
  whatsapp_number = '9000000000',
  support_phone = '9000000000',
  custom_domain = NULL;

UPDATE stores_wa_settings SET marketing_enabled = false, transactional_enabled = false;
UPDATE whatsapp_config SET is_active = false;
UPDATE platform_wa_templates SET is_active = false;
DELETE FROM wa_send_queue;
DELETE FROM whatsapp_scheduled;
DELETE FROM push_subscriptions;
DELETE FROM email_send_state;
DELETE FROM email_send_log;

-- 3. Payment credentials — replace with sandbox or nothing --------------------
UPDATE store_payment_config SET
  razorpay_key_id = NULL, razorpay_key_secret = NULL,
  cashfree_app_id = NULL, cashfree_secret_key = NULL,
  payu_key = NULL, payu_salt = NULL,
  upi_id = 'sandbox@upi',
  is_live = false;

-- 4. Trim heavy analytics so the clone is cheap and fast to restore -----------
DELETE FROM page_views        WHERE created_at < now() - interval '7 days';
DELETE FROM storefront_events WHERE created_at < now() - interval '7 days';
DELETE FROM error_logs;
DELETE FROM partner_audit_logs;
DELETE FROM stores_tracking_audit;

COMMIT;

ANALYZE;

\echo 'Sanitization complete. Verify with loadtest/data/verify-sanitized.sql before running load tests.'
