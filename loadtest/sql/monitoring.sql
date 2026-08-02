-- ShopBanao — live monitoring queries.
-- SAFE ON PRODUCTION: all read-only, all against pg_catalog / pg_stat_*.
-- Sample every 10s during a load test: loadtest/scripts/sample-db.sh
-- Run a single block with:  psql -f loadtest/sql/monitoring.sql

\echo '=== 1. CONNECTION SATURATION (the known first bottleneck) ==='
SELECT
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_conn,
  count(*)                                             AS total,
  count(*) FILTER (WHERE state = 'active')             AS active,
  count(*) FILTER (WHERE state = 'idle')               AS idle,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_txn,
  round(100.0 * count(*) /
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 1) AS pct_used
FROM pg_stat_activity;

\echo '=== 2. CONNECTIONS BY APPLICATION / USER ==='
SELECT coalesce(application_name, '(none)') AS app, usename, state, count(*)
FROM pg_stat_activity
GROUP BY 1, 2, 3
ORDER BY count(*) DESC
LIMIT 20;

\echo '=== 3. LONGEST RUNNING QUERIES RIGHT NOW ==='
SELECT
  pid,
  now() - query_start AS runtime,
  state,
  wait_event_type,
  wait_event,
  left(regexp_replace(query, '\s+', ' ', 'g'), 140) AS query
FROM pg_stat_activity
WHERE state <> 'idle' AND query_start IS NOT NULL
ORDER BY runtime DESC
LIMIT 15;

\echo '=== 4. TOP QUERIES BY TOTAL TIME (needs pg_stat_statements) ==='
SELECT
  calls,
  round(total_exec_time::numeric, 0)        AS total_ms,
  round(mean_exec_time::numeric, 2)         AS mean_ms,
  round((100 * total_exec_time / nullif(sum(total_exec_time) OVER (), 0))::numeric, 1) AS pct,
  rows,
  left(regexp_replace(query, '\s+', ' ', 'g'), 130) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

\echo '=== 5. CACHE HIT RATIO (target > 0.99) ==='
SELECT
  sum(heap_blks_hit)  AS hits,
  sum(heap_blks_read) AS reads,
  round(sum(heap_blks_hit)::numeric /
        nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0), 4) AS ratio
FROM pg_statio_user_tables;

\echo '=== 6. LOCK WAITS / BLOCKING CHAINS ==='
SELECT
  w.pid AS waiting_pid,
  left(regexp_replace(w.query, '\s+', ' ', 'g'), 80) AS waiting_query,
  b.pid AS blocking_pid,
  left(regexp_replace(b.query, '\s+', ' ', 'g'), 80) AS blocking_query,
  now() - w.query_start AS waited
FROM pg_stat_activity w
JOIN pg_stat_activity b ON b.pid = ANY(pg_blocking_pids(w.pid))
WHERE cardinality(pg_blocking_pids(w.pid)) > 0;

\echo '=== 7. SEQUENTIAL SCANS ON BIG TABLES (missing index signal) ==='
SELECT
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  n_live_tup,
  CASE WHEN seq_scan > 0 THEN seq_tup_read / seq_scan ELSE 0 END AS avg_rows_per_seq_scan
FROM pg_stat_user_tables
WHERE n_live_tup > 5000
ORDER BY seq_tup_read DESC
LIMIT 20;

\echo '=== 8. TABLE + INDEX SIZE ==='
SELECT
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) AS total,
  pg_size_pretty(pg_relation_size(relid))       AS table_only,
  pg_size_pretty(pg_indexes_size(relid))        AS indexes,
  n_live_tup,
  n_dead_tup
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 25;

\echo '=== 9. UNUSED INDEXES (drop candidates) ==='
SELECT
  s.relname AS table_name,
  s.indexrelname AS index_name,
  s.idx_scan,
  pg_size_pretty(pg_relation_size(s.indexrelid)) AS size
FROM pg_stat_user_indexes s
JOIN pg_index i ON i.indexrelid = s.indexrelid
WHERE s.idx_scan = 0 AND NOT i.indisunique AND NOT i.indisprimary
ORDER BY pg_relation_size(s.indexrelid) DESC
LIMIT 25;

\echo '=== 10. AUTOVACUUM / BLOAT PRESSURE ==='
SELECT
  relname,
  n_dead_tup,
  n_live_tup,
  round(100.0 * n_dead_tup / nullif(n_live_tup + n_dead_tup, 0), 1) AS dead_pct,
  last_autovacuum,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC
LIMIT 20;

\echo '=== 11. TRANSACTION THROUGHPUT + ROLLBACKS ==='
SELECT
  xact_commit,
  xact_rollback,
  round(100.0 * xact_rollback / nullif(xact_commit + xact_rollback, 0), 2) AS rollback_pct,
  tup_returned,
  tup_fetched,
  tup_inserted,
  tup_updated,
  tup_deleted,
  deadlocks,
  temp_files,
  pg_size_pretty(temp_bytes) AS temp_bytes
FROM pg_stat_database
WHERE datname = current_database();

\echo '=== 12. REPLICATION / WAL PRESSURE ==='
SELECT slot_name, active, pg_size_pretty(
  pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal
FROM pg_replication_slots;
