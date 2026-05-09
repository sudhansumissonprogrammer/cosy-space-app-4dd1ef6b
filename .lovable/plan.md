# Phase 2 — Wallet, Recurring Commissions, Withdrawals & Payouts

## 1. Recurring commissions (already mostly in place)

Phase 1's trigger `create_partner_commission_on_paid` fires on **every** `subscription_payments` row that turns `paid`. That already covers monthly + yearly renewals (each renewal = new payment row). Phase 2 just needs:

- **Cancellation stop**: extend `link_store_to_partner_referral` logic so commissions stop when `store_plan_assignments.billing_status = 'cancelled'` (trigger checks before insert).
- **Refund reversal**: when a `subscription_payments` row goes `paid → refunded`, mark its commission `status='reversed'` and roll back `partners.total_earnings`.

## 2. Webhook handling

Cashfree is the only active subscription-billing webhook in the project (`cashfree-webhook`). We harden it to:

- Insert/update `subscription_payments` with `status='paid' | 'failed' | 'refunded'`
- On `paid` → existing trigger creates commission (Phase 1)
- On `refunded` → new trigger reverses commission

Razorpay/Stripe webhooks: not currently used for ShopBanao plan billing — out of Phase 2 scope. We'll structure the wallet ledger so any future provider just needs to insert into `subscription_payments`.

## 3. Wallet system + ledger

New tables:

- `partner_wallets` — `partner_id (PK FK unique)`, `pending`, `approved`, `paid`, `updated_at`. "Withdrawable" = `approved - paid_pending_withdraw` (computed view).
- `partner_wallet_ledger` — `id`, `partner_id`, `direction ('credit'|'debit')`, `amount`, `kind ('commission'|'reversal'|'approval'|'withdrawal_request'|'withdrawal_paid'|'withdrawal_refund'|'adjustment')`, `commission_id?`, `withdrawal_id?`, `notes?`, `created_at`. Append-only.
- View `partner_wallet_balance` — single row per partner with computed `withdrawable = approved - locked_in_open_withdrawals`.

All wallet mutations go through SECURITY DEFINER functions: `wallet_credit_commission`, `wallet_approve_commission`, `wallet_reverse_commission`, `wallet_lock_for_withdrawal`, `wallet_settle_withdrawal`, `wallet_refund_withdrawal`. The commission trigger calls `wallet_credit_commission`. Direct ledger inserts from the client are blocked by RLS.

## 4. Hold period (14 days)

- `partner_settings.hold_days` already exists (default 14).
- New cron-driven edge function `partner-approve-commissions` runs daily:
  - finds `partner_commissions` with `status='pending'` AND `created_at < now() - hold_days` AND linked payment is still `paid`
  - moves each to `status='approved'`, calls `wallet_approve_commission` (debits pending, credits approved)
- Scheduled via `pg_cron` (already enabled per project conventions).

## 5. Withdrawal system

New table `partner_withdrawals`:

- `id`, `partner_id`, `amount`, `method ('upi'|'bank')`, `upi_id?`, `bank_account_no?`, `bank_ifsc?`, `bank_account_name?`,
- `status ('pending'|'approved'|'rejected'|'paid')`, `admin_note?`, `payout_ref?` (UTR), `requested_at`, `processed_at?`.

Partner self-service:
- `POST /partner-request-withdrawal` (edge fn): validates min amount (`partner_settings.minimum_withdrawal`), withdrawable balance, single open request rule. Locks funds via `wallet_lock_for_withdrawal`.
- Partner can cancel own `pending` withdrawal → `wallet_refund_withdrawal`.

## 6. Admin payout management

Admin actions, all via edge fn `admin-withdrawal-action` (admin-only, JWT + has_role check):
- `approve` → status `approved` (funds remain locked)
- `reject` → status `rejected` + `wallet_refund_withdrawal`
- `mark_paid` → status `paid`, requires `payout_ref`, calls `wallet_settle_withdrawal`

Admin UI page `/admin/partners/payouts` lists all withdrawals filtered by status, with action buttons + CSV export.

## 7. Analytics

`partner-analytics` edge fn returns:
- MRR contributed by referred stores (sum of latest paid `subscription_payments.amount` per active store)
- Active referrals (status `paid` + `store_plan_assignments.billing_status in (active, trialing)`)
- Churned referrals (`billing_status = cancelled` or `suspended`)
- Earnings 30/90/365-day series (sum of `partner_commissions.commission_amount` grouped by day)
- Click → signup → paid funnel %

Admin gets a global version, partner gets their scoped slice.

## 8. Notifications

Lightweight in-app notification system:

New table `partner_notifications` — `id`, `partner_id`, `type`, `title`, `body`, `read_at?`, `created_at`. 

DB triggers and wallet functions insert rows for:
- commission earned (on credit)
- commission approved (on approval)
- withdrawal requested / approved / rejected / paid

Frontend bell in partner dashboard with unread badge.

Email is out of Phase 2 scope (would need Resend templates) — backlog.

## 9. UI/UX

New partner pages:
- `/partners/dashboard/wallet` — fintech-style: 4 balance tiles (Pending, Approved, Withdrawable, Paid), ledger feed, big "Request Withdrawal" CTA.
- `/partners/dashboard/withdrawals` — request form (UPI/bank), list of past requests with status.
- `/partners/dashboard/analytics` — MRR card, earnings chart (recharts), funnel.
- Bell icon + notifications drawer.

New admin pages:
- `/admin/partners/payouts` — withdrawal queue with approve/reject/mark-paid actions and CSV export.
- Existing `/admin/partners` gets sub-tabs: Partners | Commissions | Payouts | Analytics.

Layout: convert `PartnerDashboard` to `PartnerLayout` + `<Outlet/>` with sidebar nav (Overview, Wallet, Withdrawals, Analytics).

---

## Technical details

### New tables (full SQL in migration)

```text
partner_wallets(partner_id PK FK→partners, pending numeric, approved numeric, paid numeric, updated_at)
partner_wallet_ledger(id, partner_id, direction, amount, kind, commission_id?, withdrawal_id?, notes?, created_at)
partner_withdrawals(id, partner_id, amount, method, upi_id?, bank_*?, status, admin_note?, payout_ref?, requested_at, processed_at?)
partner_notifications(id, partner_id, type, title, body, read_at?, created_at)
```

### Schema changes to existing tables

- `partner_commissions.status` whitelist extended: `pending|approved|reversed|paid|locked` (locked = inside an open withdrawal). Add CHECK via trigger (matching project convention to avoid CHECK on enum-like text columns).

### RLS

All four new tables: partner sees own rows, admin sees all. Inserts/updates blocked from clients — only SECURITY DEFINER wallet functions and admin role write.

### Edge functions

- `partner-approve-commissions` (cron, public, internal-secret-protected)
- `partner-request-withdrawal` (auth)
- `partner-cancel-withdrawal` (auth)
- `admin-withdrawal-action` (auth + admin)
- `partner-analytics` (auth)
- `admin-partners-analytics` (auth + admin)

### Cron

`pg_cron` job daily at 02:00 IST → calls `partner-approve-commissions`.

### Concurrency

All wallet functions use `SELECT ... FOR UPDATE` on `partner_wallets` row to prevent double-spend on concurrent withdrawal requests.

### Out of scope (explicit)

- Stripe/Razorpay subscription webhooks (no plan billing through them)
- Email notifications (in-app only)
- TDS / GST handling
- Multi-currency (INR only)
- KYC docs upload