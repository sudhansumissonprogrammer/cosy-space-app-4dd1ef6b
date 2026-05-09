# Referral Partner Program — 3-Phase Build

A complete affiliate ecosystem for ShopBanao.in: public landing → partner signup → referral tracking → recurring commission engine → wallet → withdrawals → admin controls.

Built on existing stack: React + Vite + Lovable Cloud (Supabase) + Cashfree webhook (already wired for SaaS billing in `cashfree-webhook/index.ts`). We'll plug commission generation directly into the existing `subscription_payments` success branch — no new payment gateway work needed.

---

## Phase 1 — Foundation: DB, Tracking, Partner Auth & Landing

Goal: Anyone can become a partner, get a referral link, and have signups attributed to them. No commissions yet.

### Database (single migration)
- `partners` — user_id, partner_code (unique, e.g. SBP1023), status (pending/active/suspended/banned), commission_pct (default 40), pan, gst, bank_account_name/number/ifsc, upi_id, fraud_score, lifetime_earnings, created_at
- `referral_clicks` — partner_id, ip, user_agent, fingerprint, landing_url, created_at
- `referral_attributions` — partner_id, referred_user_id (unique), store_id, locked_at (null until first paid payment), cookie_set_at, source_ip, status (pending/locked/rejected)
- `partner_wallets` — partner_id (unique), pending_balance, approved_balance, withdrawn_total, lifetime_total
- `commissions` — partner_id, attribution_id, store_id, subscription_payment_id (FK), gross_amount, commission_pct, commission_amount, status (pending/approved/paid/reversed), eligible_at (now+14d), billing_cycle_index, created_at
- `wallet_transactions` — partner_id, type (commission_credit/withdrawal_debit/reversal/adjustment), amount, balance_after, ref_id, ref_table, notes, created_at
- `withdrawal_requests` — partner_id, amount, method (bank/upi), payout_details (jsonb snapshot), status (pending/approved/rejected/paid), admin_notes, processed_by, processed_at, payout_reference, created_at
- `partner_program_settings` — singleton row: default_commission_pct, cookie_days (90), hold_days (14), min_withdrawal (500), plan_commission_overrides (jsonb)
- `fraud_logs` — partner_id, type, severity, details (jsonb)

RLS: partners see only their own rows; admins (via `has_role`) see all. Service role for webhooks.

Triggers/functions:
- `generate_partner_code()` — sequential SBP#### on partners insert
- `update_updated_at_column` reused
- `lock_attribution_on_first_payment()` — function called by commission engine

### Referral tracking (frontend)
- `src/lib/referralTracking.ts` — on app boot, parse `?ref=SBPxxxx`, write cookie `sb_ref` (90d) + localStorage, fire `POST /track-referral-click` edge function
- Hook into existing signup flow (`src/pages/Signup.tsx`): on successful signup, call `attribute-referral` edge function with cookie value → creates `referral_attributions` row
- Edge function `track-referral-click` — validates partner_code exists & active, logs click

### Partner auth & landing
- `src/pages/PartnerLanding.tsx` (route `/partners`) — Hero, "40% recurring", how-it-works, commission calculator (slider × plan price), benefits, FAQ, testimonials, CTAs. Reuse landing design tokens.
- `src/pages/PartnerSignup.tsx` (`/partners/signup`) — name/email/mobile/password + KYC fields. Uses Supabase auth + creates `partners` row.
- `src/pages/PartnerLogin.tsx` (`/partners/login`)
- `src/components/PartnerRoute.tsx` — guards partner area
- Add routes in `src/App.tsx`

### Minimal partner dashboard shell
- `src/layouts/PartnerLayout.tsx` + sidebar
- `src/pages/partner/PartnerOverview.tsx` — referral link, copy button, click count, signup count (real numbers, zero earnings yet)

---

## Phase 2 — Commission Engine, Wallet & Withdrawals

Goal: Real money flow. Recurring commissions credited from Cashfree webhook, partners can request payouts, admin approves.

### Commission engine
- New edge function `process-commission` (invoked from `cashfree-webhook` after `subscription_payments` is marked paid)
  - Look up store → attribution → partner
  - Skip if: no attribution, partner not active, payment refunded, self-referral (referred_user_id === partner.user_id)
  - On first paid payment: set `referral_attributions.locked_at = now()`
  - Resolve commission_pct: plan override → partner override → global default
  - Insert `commissions` row (status=pending, eligible_at=now+14d, billing_cycle_index = count of prior commissions for this attribution + 1)
  - Insert `wallet_transactions` (commission_credit) and bump `partner_wallets.pending_balance` + `lifetime_total`
- Edit `supabase/functions/cashfree-webhook/index.ts` SaaS branch: after the existing `subscription_payments` paid update, fire-and-forget `processCommission(supabase, payment.id)`
- Edge function `expire-commission-holds` (cron daily) — for commissions where `eligible_at <= now()` and status=pending → move pending→approved balance, status=approved
- Edge function `reverse-commission-on-refund` — handle refund webhook events; reverse commission if not yet paid out
- Edge function `cancel-future-commissions` — when subscription cancelled, mark attribution status=cancelled (no future commissions, past ones honored)

### Partner dashboard — full
- Overview cards: total earnings, pending, withdrawable (approved), active referrals, MRR, conversion rate
- Referral Tools page: link, copy, QR (qrcode lib), WhatsApp/Telegram/Email share intents
- Referral Analytics: clicks/signups/trials/paid/active/churned (from existing tables joined)
- Earnings: commissions table with filters, recurring grouping per attribution
- Wallet: balances + transaction ledger
- Withdrawals: request form (validates min + approved balance), history
- Profile/KYC: edit bank/UPI/PAN/GST

### Notifications
- Reuse existing email infra (RESEND_API_KEY already configured) — send on: signup, first paid commission, withdrawal status changes
- In-app: `partner_notifications` table + bell icon

---

## Phase 3 — Admin, Fraud Prevention & Advanced

Goal: Admin operates the program; fraud guarded; gamification.

### Admin panel (under existing `/admin`)
- `AdminPartners.tsx` — list, approve/suspend/ban, edit commission_pct, view performance
- `AdminReferralStores.tsx` — referred stores with linked partner, plan, MRR
- `AdminCommissionLedger.tsx` — all commissions, filters (partner/store/status/date), CSV export
- `AdminWithdrawalRequests.tsx` — approve / reject / mark paid (with payout reference), CSV export
- `AdminFraudLogs.tsx`
- `AdminPartnerSettings.tsx` — global settings + plan-wise overrides
- Wire into `AdminSidebar.tsx`

### Fraud prevention
- Edge function `fraud-check` runs on signup attribution + commission generation:
  - Self-referral (same user_id or same email/phone)
  - Same IP cluster (>3 signups same /24 in 24h)
  - Same device fingerprint reuse
  - Refund-rate threshold per partner
  - Auto-suspend at fraud_score >= 80, log entries
- Webhook signature verification (already exists for Cashfree — good)
- Audit log table for admin actions

### Advanced
- Leaderboard page (public + partner) — top earners this month
- Tiers/badges: Bronze/Silver/Gold/Platinum based on lifetime_earnings → unlocks higher commission_pct
- Coupon code attribution: partners can claim a coupon code; checkout matching that coupon attributes to partner even without cookie
- Realtime dashboard: Supabase realtime on `commissions` and `wallet_transactions` for the logged-in partner
- CSV exports across admin tables; analytics charts via recharts (already in deps likely)

---

## Technical notes
- Cashfree is the live gateway; Razorpay/Stripe webhooks are out of scope for this build (no infra exists). Phase 2 wires Cashfree only; structure leaves room for additional gateways by keeping commission engine driven off `subscription_payments` rows, not raw webhook payloads.
- All money in INR paise-safe numerics; use `numeric(12,2)`.
- `has_role(auth.uid(),'admin')` already in DB — reused for admin RLS.
- No client-side admin checks; all gated server-side.
- Don't show pricing on the public partner landing per project memory — keep "earn 40% recurring" framing without ₹ amounts on landing CTAs.

---

## Deliverable per phase
- Phase 1: working referral capture + partner accounts (no $ flow)
- Phase 2: live recurring commissions + payouts requestable
- Phase 3: admin operates fully + fraud + gamification

I'll implement Phase 1 in this turn after approval, then ask before continuing to Phase 2 and Phase 3.
