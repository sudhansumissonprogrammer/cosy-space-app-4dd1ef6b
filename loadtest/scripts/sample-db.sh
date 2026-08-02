#!/usr/bin/env bash
# Sample Postgres every N seconds during a load test. READ-ONLY — safe on prod.
#
#   ./loadtest/scripts/sample-db.sh 10 600 > /tmp/db-samples.tsv
#     arg1 = interval seconds (default 10)
#     arg2 = total duration seconds (default 600)
#
# Output is TSV so it can go straight into a spreadsheet / plot.
set -euo pipefail

INTERVAL="${1:-10}"
DURATION="${2:-600}"
END=$(( $(date +%s) + DURATION ))

if [ -z "${PGHOST:-}" ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "Set PGHOST/PG* or DATABASE_URL first." >&2
  exit 1
fi

printf 'ts\ttotal\tactive\tidle\tidle_in_txn\tpct_used\tcache_ratio\tblocked\tdeadlocks\n'

while [ "$(date +%s)" -lt "$END" ]; do
  psql -qAt -F $'\t' -c "
    SELECT
      to_char(now(),'HH24:MI:SS'),
      (SELECT count(*) FROM pg_stat_activity),
      (SELECT count(*) FROM pg_stat_activity WHERE state='active'),
      (SELECT count(*) FROM pg_stat_activity WHERE state='idle'),
      (SELECT count(*) FROM pg_stat_activity WHERE state='idle in transaction'),
      round(100.0*(SELECT count(*) FROM pg_stat_activity)/
        (SELECT setting::int FROM pg_settings WHERE name='max_connections'),1),
      (SELECT round(sum(heap_blks_hit)::numeric/
        nullif(sum(heap_blks_hit)+sum(heap_blks_read),0),4) FROM pg_statio_user_tables),
      (SELECT count(*) FROM pg_stat_activity WHERE cardinality(pg_blocking_pids(pid))>0),
      (SELECT deadlocks FROM pg_stat_database WHERE datname=current_database())
  "
  sleep "$INTERVAL"
done
