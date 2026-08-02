#!/usr/bin/env bash
# Lightweight production health check. ~8 GET requests total — negligible load.
# Safe to run on a 1-minute cron.
#
#   BASE_URL=https://serdiyajewellers.shop ./loadtest/scripts/health-check.sh
#   Exit 0 = healthy, 1 = degraded (wire to alerting).
set -uo pipefail

BASE="${BASE_URL:-https://shopbanao.in}"
UA="shopbanao-healthcheck"
FAIL=0

probe() { # path  expected_status  budget_ms  label
  local path="$1" want="$2" budget="$3" label="$4"
  local out code total cache
  out=$(curl -sS -o /dev/null -A "$UA" \
        -w '%{http_code} %{time_total} %{header_json}' \
        --max-time 15 "$BASE$path" 2>/dev/null) || { echo "FAIL  $label  (curl error)"; FAIL=1; return; }
  code=$(echo "$out" | awk '{print $1}')
  total=$(echo "$out" | awk '{print $2}')
  ms=$(awk -v t="$total" 'BEGIN{printf "%d", t*1000}')
  cache=$(echo "$out" | grep -o '"cf-cache-status":\["[^"]*"' | head -1 | sed 's/.*\["//')
  local status="OK  "
  if [ "$code" != "$want" ]; then status="FAIL"; FAIL=1
  elif [ "$ms" -gt "$budget" ]; then status="SLOW"; FAIL=1; fi
  printf '%s  %-22s http=%s  %sms (budget %sms)  cache=%s\n' \
    "$status" "$label" "$code" "$ms" "$budget" "${cache:-n/a}"
}

echo "ShopBanao health check → $BASE  ($(date -u +%FT%TZ))"
probe "/"             200 2000 "landing/home"
probe "/products"     200 2500 "catalog"
probe "/robots.txt"   200 1000 "static"
probe "/sitemap.xml"  200 2000 "sitemap"

# Backend liveness — anon REST root, no data read.
if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  code=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 \
    -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/" || echo 000)
  if [ "$code" = "200" ]; then echo "OK    backend rest api      http=200"
  else echo "FAIL  backend rest api      http=$code"; FAIL=1; fi
fi

[ "$FAIL" -eq 0 ] && echo "→ healthy" || echo "→ DEGRADED"
exit "$FAIL"
