-- STAGING ONLY — remove rows created by k6 write-path tests.
-- Identified by the reserved 90000xxxxx phone block and the k6 source tag.
DO $$
BEGIN
  IF current_database() !~* '(staging|stage|test|clone)' THEN
    RAISE EXCEPTION 'Refusing to clean: database "%" does not look like staging', current_database();
  END IF;
END $$;

BEGIN;

CREATE TEMP TABLE _lt AS
SELECT id FROM orders
WHERE customer_address = 'LOADTEST — do not ship'
   OR customer_name LIKE 'LoadTest %';

DELETE FROM order_items          WHERE order_id IN (SELECT id FROM _lt);
DELETE FROM store_order_commissions WHERE order_id IN (SELECT id FROM _lt);
DELETE FROM order_shipments      WHERE order_id IN (SELECT id FROM _lt);
DELETE FROM orders               WHERE id IN (SELECT id FROM _lt);
DELETE FROM customer_leads       WHERE name = 'Test Lead' AND created_at > now() - interval '1 day';
DELETE FROM abandoned_carts      WHERE customer_phone LIKE '90000%';

COMMIT;
VACUUM ANALYZE orders;
