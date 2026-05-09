# Referral Partner Program — Phase 1

Building the core MVP of the ShopBanao Partner Program: tracking, attribution, basic commissions, partner dashboard, and admin panel. Phase 2 (payouts/wallet/withdrawal automation, KYC) and Phase 3 (fraud engine, leaderboard, advanced analytics) come later.

## What ships in Phase 1

1. **Partner landing page** — `/partners` with hero, benefits, how-it-works, commission explanation, FAQ, Join + Login CTAs.
2. **Partner auth** — signup / login / forgot-password using existing Supabase auth, segregated by user role `partner`.
3. **Partner dashboard** — `/partners/dashboard` with totals (clicks, signups, paid customers, estimated earnings), referral link, copy / WhatsApp share / QR code, recent referrals + commissions tables.
4. **Referral tracking** — `?ref=SBP1023` query param captured anywhere on the site, saved as `sb_ref` cookie (90 days), and a click row inserted via edge function.
5. **Attribution** — on signup, the cookie's referral code is read and a `partner_referrals` row is created locking the user (and later their store/subscription) to that partner.
6. **Basic commission engine** — when a `subscription_payments` row transitions to `status = 'paid'`, a Postgres trigger inserts a `commissions` row using the partner's `commission_percentage` (with plan-wise override fallback).
7. **Admin panel** — new `/admin/partners` section: list partners, edit %, suspend, view referred stores, view commissions ledger.

## Out of scope for Phase 1
- Wallet states, withdrawal workflow, payout marking, KYC capture, bank/UPI fields beyond basics
- Recurring webhook integration with Razorpay/Stripe (commissions will be created off the existing internal `subscription_payments`/billing events; we'll wire real webhooks in Phase 2)
- Fraud detection, leaderboard, badges, exports
- Email + in-app notifications (will be added in Phase 2 alongside payouts)

## Database schema (new tables)

```text
partners
  id uuid pk, user_id uuid (auth.users) unique
  partner_code text unique           -- e.g. SBP1023
  name, email, mobile
  commission_percentage numeric default 40
  status text default 'active'       -- active | suspended
  created_at, updated_at

partner_referral_clicks
  id, partner_id fk, ip, user_agent, referrer, landing_path, created_at

partner_referrals
  id, partner_id fk
  referred_user_id uuid (auth.users) -- set on signup
  store_id uuid null                 -- set when store is created
  status text default 'signup'       -- signup | trial | paid | churned
  first_paid_at timestamptz null
  locked boolean default false       -- true after first paid payment
  created_at

partner_commissions
  id, partner_id fk, referral_id fk
  store_id, subscription_id, payment_id
  amount_paid numeric, percentage numeric, commission_amount numeric
  status text default 'pending'      -- pending | approved | paid | reversed
  created_at

partner_settings (singleton row, admin-tunable)
  default_percentage numeric default 40
  cookie_days int default 90
  hold_days int default 14
  minimum_withdrawal numeric default 500
```

Plus: add nullable `referred_by_partner_id` to `stores` for fast joins, and a `partner` value to the existing `app_role` enum.

## Attribution flow

```text
Visitor → /signup?ref=SBP1023
   ↓ ReferralCapture component reads ?ref, sets sb_ref cookie (90d),
     fires edge fn track-referral-click → partner_referral_clicks row
   ↓
Signup → after auth.signUp success, client calls edge fn attach-referral
     which validates sb_ref, finds partner by code, inserts partner_referrals
   ↓
Store creation → trigger updates partner_referrals.store_id + stores.referred_by_partner_id
   ↓
First successful subscription payment → DB trigger fn create_partner_commission()
     inserts partner_commissions, marks referral.status='paid' + locked=true
```

## Edge functions

- `track-referral-click` (public, no JWT) — validates `ref` code, records click, returns 200.
- `attach-referral` (auth required) — runs after signup, links the new auth user to a partner via cookie/header value, idempotent.
- `partner-stats` (auth required, partner role) — returns aggregated dashboard numbers from a single SQL call.

## Routes

```text
/partners                       public landing
/partners/login                 partner login
/partners/signup                partner signup (no referral capture here)
/partners/forgot-password
/partners/dashboard             overview + referral tools
/partners/referrals             referrals table
/partners/commissions           commissions ledger
/partners/profile               basic profile edit

/admin/partners                 list + filters
/admin/partners/:id             detail (edit %, suspend, see stores+commissions)
/admin/partners/commissions     global commissions ledger
/admin/partners/settings        defaults (%, cookie days, hold days)
```

## RLS summary

- `partners`: partner can select/update own row (by `user_id`); admin full access.
- `partner_referrals`, `partner_commissions`: partner can only `select` rows where `partner_id` matches their own; admin full access; service role inserts via triggers / edge functions.
- `partner_referral_clicks`: insert allowed via edge function (service role); partner select own; admin full.
- `partner_settings`: admin only.

## Implementation order

1. Migration for tables, enum extension, RLS, trigger, helper SQL fn `is_partner_owner(partner_id)`.
2. Landing page + partner auth pages (reusing existing auth UI patterns).
3. Referral capture util + `track-referral-click` edge fn.
4. Partner dashboard shell + `partner-stats` edge fn + referral/commission tables.
5. `attach-referral` edge fn wired into signup flow + storefront signup flow.
6. Admin partner pages plugged into existing AdminSidebar/AdminLayout.
7. Smoke test: open `/signup?ref=…`, complete flow with a fake `subscription_payments` insert, confirm commission row appears with correct math.

## Open question — confirm before I migrate

The existing app has a `subscriptions` table tied to `user_id` (merchant) and `plan_id`, but I don't see a `subscription_payments` table in the schema dump above. **Where does a successful paid subscription currently get recorded?** Options:

1. There's already a payments/invoices table I should hook the trigger into — tell me its name.
2. There isn't one yet — I'll add a minimal `subscription_payments(store_id, plan_id, amount, status, paid_at)` table as part of this migration so the commission trigger has something to fire on.

Reply with the table name (or "create it") and I'll start with the migration.
