---
name: uptime-monitor
description: 24/7 synthetic uptime monitoring of all storefronts + platform APIs with WhatsApp alerts to the founder
type: feature
---

# Uptime monitor (v1)

- Edge fn `uptime-monitor`, pg_cron job `uptime-monitor-1min` (every minute, x-cron-secret auth).
- Tables: `uptime_targets` (auto-synced from `stores` every 10 min + fixed platform targets: landing, REST API, auth health, edge functions), `uptime_checks` (failures + 1-in-10-min samples), `uptime_incidents`, `uptime_alert_recipients` (seeded 919692282485).
- 60 targets probed per run, concurrency 10, 12s timeout. Incident opens after 2 consecutive failures → one WhatsApp alert; recovery alert on heal with downtime duration.
- Alerts go through `wa-platform-send` with `message_type: "platform_alert"` and template `platform_alert_v1` (4 vars: headline, target, details, IST time). `platform_alert` is in the TRANSACTIONAL set so it bypasses marketing caps, opt-outs and quality throttles.
- Meta rejects templates with too many variables for their length ("Params Words Ratio Exceeds Limit") — keep alert body copy long relative to placeholder count.
- Alert send contract (fixed 2026-08-08): `wa-platform-send` expects `recipient_phone` (not `phone`) AND an `x-cron-secret` header (service-role bearer alone returns 401). Monitors read the secret from `public.cron_auth`. `platform_alert_v1` is APPROVED by Meta and verified end-to-end.
- `uptime-monitor` accepts `{"test_alert":true}` to fire a manual WhatsApp test alert.
