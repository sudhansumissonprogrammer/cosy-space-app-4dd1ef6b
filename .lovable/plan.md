
# Commission-Based Billing + Store Wallet

Add a second billing mode alongside the existing subscription system. Each store stays on **Subscription** by default — nothing about subscription flow changes. Admin can switch a store to **Commission** mode, which activates a prepaid wallet. Every confirmed/paid/shipped/delivered order debits commission (default 3% of order total) from the wallet. Stores top up via Cashfree (min ₹700).

---

## 1. Billing mode model

- New column `stores.billing_mode` → `'subscription'` (default) | `'commission'`.
- Only admin can change it (RLS + admin edge function).
- When mode = `subscription`: existing subscription flow unchanged. Wallet UI hidden. Partner referrals continue to work.
- When mode = `commission`:
  - Store's `store_plan_assignments.billing_status` is forced to `lifetime` so paywalls/cron leave it alone (no subscription dues, no suspension from billing-cron).
  - Wallet becomes the source of truth. If wallet balance < 0 (or < a configurable threshold), store is "billing-blocked" — checkout still works but admin gets alerted and storefront shows a soft warning (configurable later).
  - Store is **excluded from partner referral commission** (rule enforced in `create_partner_commission_on_paid` trigger + `attach-referral` edge fn).

## 2. New tables

- **`store_commission_config`** — one row per commission-mode store
  - `store_id` (unique), `commission_percentage` (default 3.00), `min_recharge` (default 700), `low_balance_threshold` (default 100), `is_active`
- **`store_wallets`**
  - `store_id` (unique), `balance` numeric default 0, `total_recharged`, `total_charged`, `updated_at`
- **`store_wallet_ledger`** — every credit/debit (immutable audit trail)
  - `store_id`, `direction` (`credit`|`debit`), `amount`, `kind` (`recharge`|`order_commission`|`refund`|`admin_adjustment`), `order_id` (nullable), `recharge_id` (nullable), `balance_after`, `notes`, `created_at`
- **`store_wallet_recharges`** — Cashfree top-up records (mirrors `subscription_payments` shape so we reuse the proven flow)
  - `store_id`, `cashfree_order_id` (unique), `cashfree_payment_id`, `amount`, `status` (`pending`|`paid`|`failed`|`refunded`), `payment_method`, `paid_at`, `raw_payload`, timestamps
- **`store_order_commissions`** — per-order commission record (idempotent via unique `order_id`)
  - `order_id` (unique), `store_id`, `order_total`, `percentage`, `commission_amount`, `status` (`charged`|`reversed`|`skipped_subscription`), `ledger_id`, `created_at`

All tables: RLS — admin full access, store owner read-only for own store. Ledger/commissions never UPDATEable by owners.

## 3. Commission charging trigger

PostgreSQL trigger on `orders` (AFTER INSERT, AFTER UPDATE OF status):
- Fires once per order when status transitions into one of `confirmed`, `shipped`, `delivered`, `partially_paid`.
- Idempotent: check `store_order_commissions.order_id` first.
- If `stores.billing_mode <> 'commission'` → insert row with status `skipped_subscription` and exit (audit only, no charge).
- Else: compute `commission = round(orders.total * pct / 100, 2)`, debit wallet (locked row update), write ledger row, insert commission row with status `charged`.
- If status moves to `cancelled`/`refunded` after being charged → reverse: credit wallet back, ledger `refund`, commission row → `reversed`.

Functions are `SECURITY DEFINER` with locked-row pattern (same as existing `wallet_credit_commission`).

## 4. Cashfree wallet top-up (mirror of subscription flow)

Reuses the same proven Cashfree pattern as `cashfree-create-order` / `cashfree-verify-payment` / `cashfree-webhook` — **separate edge functions** so the two flows never collide:

- **`wallet-cashfree-create-order`** — auth required; validates `amount >= store_commission_config.min_recharge`; creates Cashfree order; inserts `store_wallet_recharges` row with status `pending`.
- **`wallet-cashfree-verify`** — client polls after redirect; verifies status with Cashfree; on `PAID`, calls SQL fn `wallet_apply_recharge(_recharge_id)` (idempotent: only credits if status was `pending`).
- **`wallet-cashfree-webhook`** — server-to-server confirmation (verify_jwt=false); same idempotent apply.

`wallet_apply_recharge` updates `store_wallets.balance += amount`, inserts ledger row `kind='recharge'`, sets recharge to `paid`.

**Conflict prevention**: the two flows write to completely separate tables (`subscription_payments` vs `store_wallet_recharges`) and use a different Cashfree order_id prefix (`SUBPAY_` vs `WALLET_`). The shared Cashfree credentials live in the same store config — no change there.

## 5. Admin UI (in `AdminUsersStores` / `AdminSubscriptions`)

- Per-store toggle: **Subscription** ⇄ **Commission** (with confirmation dialog explaining the switch).
- When commission: admin can set `commission_percentage`, `min_recharge`, do wallet adjustments (credit/debit with note), view ledger, view recharge history.
- New page **AdminWallets** — list of all commission-mode stores with balance, last recharge, total charged, low-balance flag.

## 6. Store owner UI (Dashboard)

- New sidebar item **Wallet** — only visible when `billing_mode = 'commission'`.
- Page shows: current balance, recent ledger (debits per order with order link, credits per recharge), "Recharge" button.
- Recharge dialog: amount input (min ₹700 enforced both client + server), Cashfree checkout.
- Order list shows a small "₹X commission" badge per charged order.
- Existing **Billing/Subscription** pages are hidden for commission stores (replaced by Wallet).

## 7. Partner referral exclusion

- `create_partner_commission_on_paid` (existing trigger) gets an early `RETURN NEW` if the store is in commission mode.
- `attach-referral` edge fn rejects attaching a referral to a commission-mode store with a clear error.
- Already-attached referrals on a store that later switches to commission: stop earning new commissions (trigger guard handles it), existing approved/paid commissions are untouched.

## 8. Safety / conflict checklist

- Subscription cron (`billing-cron`) skips stores with `billing_mode='commission'` (extra WHERE clause).
- `BillingPaywall` component checks `billing_mode` and renders nothing for commission stores.
- Cashfree webhook signature verification (same logic as existing webhook) — no shortcut.
- All wallet mutations go through `SECURITY DEFINER` functions with `FOR UPDATE` row locks → no race on concurrent orders + recharges.
- `store_wallet_ledger.balance_after` written inside the same transaction = tamper-evident audit.
- No `auth.users` FK on wallet tables (project rule).
- Migration includes the `DROP FUNCTION IF EXISTS` guard for any storefront RPC we touch (we don't touch any).

## Technical details

**New DB objects**
- Tables: `store_commission_config`, `store_wallets`, `store_wallet_ledger`, `store_wallet_recharges`, `store_order_commissions`
- Column: `stores.billing_mode text not null default 'subscription'`
- Functions: `wallet_charge_order(_order_id)`, `wallet_reverse_order(_order_id)`, `wallet_apply_recharge(_recharge_id)`, `wallet_adjust_store(_store_id, _direction, _amount, _note)`, `is_store_commission_mode(_store_id)`
- Triggers: `tg_order_commission_charge` on `orders`, modify `create_partner_commission_on_paid` to skip commission-mode stores

**New edge functions**
- `wallet-cashfree-create-order`, `wallet-cashfree-verify`, `wallet-cashfree-webhook` (verify_jwt=false in `supabase/config.toml`)
- `admin-set-billing-mode` (admin-only, switches mode + ensures wallet/config rows exist)
- `admin-wallet-adjust` (admin manual credit/debit)

**New frontend**
- `src/pages/StoreWallet.tsx` (owner)
- `src/pages/admin/AdminWallets.tsx` (admin list)
- `src/components/admin/BillingModeToggle.tsx`
- `src/components/wallet/WalletBalanceCard.tsx`, `RechargeDialog.tsx`, `WalletLedgerTable.tsx`
- `src/hooks/useStoreWallet.ts`
- Routing + sidebar updates in `AppSidebar.tsx` and dashboard router
- Hide `BillingSection` / `BillingPaywall` when `billing_mode='commission'`

**Existing files touched (small surgical edits only)**
- `supabase/functions/billing-cron/index.ts` — skip commission stores
- `supabase/functions/attach-referral/index.ts` — reject commission stores
- DB migration updates `create_partner_commission_on_paid` to skip
- `AppSidebar.tsx`, `DashboardLayout.tsx` — conditional Wallet nav

**Defaults**
- commission_percentage: 3.00
- min_recharge: 700
- charged statuses: `confirmed, shipped, delivered, partially_paid` (matches dashboard revenue calc)
- low_balance_threshold: 100

**Out of scope (will ask before adding)**
- Auto-suspend storefront on zero balance (currently soft warning only)
- Auto-recharge / saved payment method
- GST invoice generation for recharges
