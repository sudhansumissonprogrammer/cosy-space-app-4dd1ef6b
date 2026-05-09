## Phase 3 — Referral Partner Program

Phase 1 (signup/referrals) and Phase 2 (wallet/withdrawals/recurring) are live. Phase 3 layers automation, analytics, scale and enterprise admin tooling on top — no fraud/IP/abuse systems per your instruction.

### 1. Advanced commission rules (engine)

New table `partner_commission_overrides`:
- `partner_id`, `plan_id?` (nullable = applies to all plans), `percentage`, `starts_at?`, `ends_at?`, `note?`, `is_active`
- Supports plan-wise %, partner-specific %, time-bound campaigns, enterprise deals.

Resolution order inside `create_partner_commission_on_paid` trigger:
1. Active override matching `partner_id + plan_id` and current date in window
2. Active override matching `partner_id + plan_id IS NULL`
3. `partners.commission_percentage`
4. Default 40

Admin UI on `/admin/partners/:id` — overrides tab to add/expire rules.

### 2. Audit log system

New table `partner_audit_logs`:
- `id, actor_user_id, actor_role, action, target_type, target_id, old_value jsonb, new_value jsonb, note, created_at`
- Helper `log_partner_audit(action, target_type, target_id, old, new, note)` SECURITY DEFINER.
- Wired into: withdrawal approve/reject/mark_paid, commission adjust, partner status change, override create/edit, wallet manual adjust.
- Admin viewer at `/admin/partners/audit` with filters (actor, action, date).

### 3. Advanced admin controls

New edge function `admin-partner-controls` (admin-only) supports:
- `adjust_commission` — change `commission_amount`/status with audit trail + ledger entry
- `wallet_adjustment` — credit/debit `approved`/`pending` (kind=`adjustment`)
- `pause_payouts` / `resume_payouts` — `partners.payouts_paused boolean`
- `set_partner_status` — active / suspended / banned

UI: actions on `AdminPartners` detail drawer.

### 4. Realtime + advanced analytics

- Enable Realtime on `partner_referral_clicks`, `partner_referrals`, `partner_commissions`, `partner_wallet_ledger`.
- Extend `partner-analytics`:
  - clicks/signups/paid for 7d / 30d / 90d
  - MRR + ARR estimates, churn rate, ARPU
  - Daily commission series, plan-mix breakdown
- New global `admin-partners-analytics` (totals, top 10 partners, payout liability).
- Partner Overview + Analytics pages get realtime "live counter" cards via Supabase channels.

### 5. Exports & reports

New edge function `partner-exports` returns CSV streams (admin or scoped partner):
- `commissions` — filters: partner, plan, date range, status
- `payouts` — filters: status, date, partner
- `partner-performance` — clicks, signups, paid, total earnings by partner
- `subscriptions` — referred stores with plan, MRR, billing_status

Admin UI on `/admin/partners/exports` + buttons on existing pages.

### 6. Scalability & performance

- Indexes:
  - `partner_commissions(partner_id, status, created_at desc)`
  - `partner_commissions(payment_id)` (already unique-partial — keep)
  - `partner_wallet_ledger(partner_id, created_at desc)`
  - `partner_withdrawals(partner_id, status, created_at desc)`
  - `partner_referrals(partner_id, status)`, `partner_referrals(store_id)`
  - `partner_referral_clicks(partner_id, created_at desc)`
  - `partner_audit_logs(target_type, target_id, created_at desc)`
- React Query: `staleTime: 60_000` on partner dashboard reads, `keepPreviousData` on paginated lists.
- `partner-wallet`/`partner-analytics` add `Cache-Control: private, max-age=15` for safe-to-cache shapes.
- Pagination on ledger / withdrawals / commissions admin tables (cursor-based via `created_at,id`).

### 7. Security hardening

- All admin edge functions: verify JWT + `has_role(_, 'admin')` server-side (already partially done — finish missing ones).
- `partner-approve-commissions` cron secret already added in last loop — keep.
- Rate-limit `partner-request-withdrawal` (1 request / 10s / partner) using a small `partner_rate_limits` table.
- Webhook signature verification on `cashfree-webhook` — already present, add idempotency log table `webhook_events(provider, event_id PK, processed_at)` to make retries safe.
- `partner_audit_logs` doubles as security log for sensitive admin actions.

### 8. UI polish (Shopify Partners / Stripe / Rewardful feel)

- Replace partner overview tiles with gradient "card-stat" components, sparklines (recharts mini).
- Add skeleton loaders + optimistic updates on withdrawal request.
- Dark, dense data tables on admin (sticky header, zebra rows, column-resize off, but compact density).
- Empty states with illustrations + helpful CTAs.
- `PartnerLayout` topbar gets notifications bell (already there) + partner code copy chip + "Refer & Earn" gradient CTA.

### Out of scope (per your instructions)

- Fraud detection / IP blocks / abuse engine
- Leaderboards / gamification / badges
- Coupon attribution
- Email notifications (in-app only — Phase 2 decision stands)

---

### Execution order (single migration + code rounds)

1. Migration: new tables (`partner_commission_overrides`, `partner_audit_logs`, `webhook_events`, `partner_rate_limits`), new columns (`partners.payouts_paused`), helper functions (`resolve_partner_commission_pct`, `log_partner_audit`), updated `create_partner_commission_on_paid`, indexes, realtime publication.
2. Edge functions: `admin-partner-controls`, `partner-exports`, `admin-partners-analytics`, expand `partner-analytics`, harden `partner-request-withdrawal`.
3. Frontend: admin overrides UI, admin audit log viewer, admin exports page, pause-payouts/wallet-adjust drawer actions, partner overview realtime sparklines + polish.
4. QA: deploy edge fns, smoke test each via curl, verify realtime flows, run linter.

This is the scope I'll build in this loop — confirm and I'll start.