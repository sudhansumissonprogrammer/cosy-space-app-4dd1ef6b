---
name: No uptime monitoring system
description: Uptime/health monitoring was fully removed on 2026-08-21; never re-add uptime checks, health-signals cron or storefront pinging
type: constraint
---
Removed completely (user request — every-minute pings to 78 live storefronts + 185k-row/30MB uptime_checks table were a risk to running stores):

- Cron jobs `uptime-monitor-1min` and `health-signals-5min` unscheduled.
- Edge functions `uptime-monitor` and `health-signals` deleted.
- Tables `uptime_targets`, `uptime_checks`, `uptime_incidents`, `uptime_alert_recipients` dropped.
- Admin page `/admin/uptime` (AdminUptime.tsx), sidebar + AdminLayout entries, route removed.
- WhatsApp template `platform_alert_v1` set `is_active = false`.

Never re-introduce automated storefront pinging, uptime tables, or platform alert WhatsApp blasts unless the user explicitly asks again.
