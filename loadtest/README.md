# loadtest/

Load testing + monitoring for ShopBanao. Full documentation:
[`docs/LOAD-TESTING-FRAMEWORK.md`](../docs/LOAD-TESTING-FRAMEWORK.md).

## Rules

1. **Production gets passive monitoring and read-only canaries only.**
   Live Meta Ads traffic is converting; nothing here may risk it.
2. Destructive scripts refuse to start unless `TARGET_ENV=staging` **and** the
   target host is not in `PRODUCTION_HOSTS` (`lib/config.js`). There is no
   override flag — this is intentional.
3. Never point any script at a store with live Pixel/CAPI or WhatsApp
   credentials. Sanitize first (`data/sanitize-staging.sql`), verify second
   (`data/verify-sanitized.sql`).

## Quick start

```bash
# PRODUCTION — safe
BASE_URL=https://serdiyajewellers.shop ./scripts/health-check.sh
BASE_URL=https://serdiyajewellers.shop VUS=5 k6 run k6-prod-canary.js
./scripts/sample-db.sh 10 600 > /tmp/db.tsv

# STAGING — destructive
export TARGET_ENV=staging BASE_URL=https://staging.example.dev
K6_SCENARIO=step k6 run k6-staging-storefront.js
```

| Script | Target | Writes? |
|---|---|---|
| `k6-prod-canary.js` | prod or staging | no |
| `k6-staging-storefront.js` | staging only | no |
| `k6-staging-edge-functions.js` | staging only | no |
| `k6-staging-checkout-write.js` | staging only | **yes — real orders** |

Profiles: `smoke` `ramp` `step` `spike` `soak` (`K6_SCENARIO=`).

After a run, copy `reports/TEMPLATE.md` to `reports/<date>-<scenario>.md` and
fill it with measured values. Never estimate a number in a report.

## Custom Serdiya site (Python)

`python-serdiya-capacity.py` tests only public catalog `GET` pages discovered
from the sitemap. It never calls cart writes, checkout actions, accounts,
admin, payments, APIs, forms, or webhooks.

```bash
# Live site: permanently limited, read-only profiles
python loadtest/python-serdiya-capacity.py --profile baseline
python loadtest/python-serdiya-capacity.py --profile canary

# Heavy profiles: staging hostname only
python loadtest/python-serdiya-capacity.py \
  --base-url https://staging.example.com \
  --target-env staging --profile ramp
```

Profiles: `baseline`, `canary`, `ramp`, `spike`, `soak`. The last three refuse
to run on `serdiyajewellers.com` and `www.serdiyajewellers.com`, with no bypass
option. Tests stop when errors exceed 1%, p95 exceeds 3× baseline, or three
consecutive 5xx responses occur. Results are written as CSV, JSON, and Markdown
under `/tmp/serdiya-capacity` by default.
