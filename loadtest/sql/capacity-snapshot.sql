-- ShopBanao — one-shot capacity snapshot.
-- SAFE ON PRODUCTION (read-only). Capture BEFORE and AFTER every load test
-- and diff the two, plus once daily as a baseline.
--   psql -f loadtest/sql/capacity-snapshot.sql > snapshots/$(date +%FT%H%M).txt

\echo '--- identity ---'
SELECT current_database() AS db, version(), now() AS captured_at;

\echo '--- sizing knobs ---'
SELECT name, setting, unit
FROM pg_settings
WHERE name IN (
  'max_connections','shared_buffers','effective_cache_size','work_mem',
  'maintenance_work_mem','max_worker_processes','max_parallel_workers',
  'statement_timeout','idle_in_transaction_session_timeout','random_page_cost'
)
ORDER BY name;

\echo '--- database size ---'
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;

\echo '--- row counts of hot tables ---'
SELECT relname, n_live_tup
FROM pg_stat_user_tables
WHERE relname IN (
  'orders','order_items','products','page_views','page_views_daily',
  'storefront_events','abandoned_carts','customer_leads','wa_send_queue',
  'whatsapp_messages','live_sessions','error_logs'
)
ORDER BY n_live_tup DESC;

\echo '--- growth-rate inputs (orders + events per day, last 14d) ---'
SELECT date_trunc('day', created_at)::date AS day, count(*) AS orders
FROM orders WHERE created_at > now() - interval '14 days'
GROUP BY 1 ORDER BY 1;

\echo '--- reset point for pg_stat_statements ---'
SELECT stats_reset FROM pg_stat_statements_info;
