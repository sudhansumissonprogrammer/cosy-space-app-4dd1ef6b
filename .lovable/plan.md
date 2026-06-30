
# Remove Subscription Model — Switch Fully to 3% Commission

## Audit Summary (what exists today)

**Two billing modes in `stores.billing_mode`:** `subscription` and `commission`. The commission engine is fully built and live:

- `store_commission_config` (per-store %, min recharge, low balance threshold)
- `store_wallets`, `store_wallet_ledger`, `store_wallet_recharges`
- `store_order_commissions` + triggers (`tg_order_commission_handler`, `tg_after_commission_insert`, `wallet_*` RPCs)
- `is_store_commission_mode()` gate

**Subscription stack (to retire):**
- Tables: `plans`, `subscriptions` (0 rows), `subscription_payments`, `store_plan_assignments` (17 rows — legacy)
- RPCs: `get_store_billing_state`, `validate_billing_status`, `validate_subscription_payment_status`, `tg_subscription_payment_refund`, `auto_assign_new_plan_to_stores`, `auto_assign_plan_to_new_store`, `admin_set_billing_mode`
- Edge fns: `assign-store-plan`, `billing-cron`, `cashfree-create-order` + `cashfree-verify-payment` + `cashfree-webhook` (subscription checkout flow)
- Frontend: `useBillingState`, `BillingPaywall`, `BillingBanner`, `BillingSection`, `AdminSubscriptions` page, sidebar entries, dashboard banners, paywall gating on Cart/PDP/SideCart

## Plan

### 1. Database migration (single migration)
- Backfill: `UPDATE stores SET billing_mode='commission'` for all stores.
- Insert `store_commission_config` rows for every store missing one, default `commission_percentage=3.00`, `min_recharge=500`, `low_balance_threshold=100`, `is_active=true`.
- Drop triggers/functions tied to subscriptions: `tg_subscription_payment_refund`, `validate_subscription_payment_status`, `validate_billing_status`, `get_store_billing_state`, `auto_assign_new_plan_to_stores`, `auto_assign_plan_to_new_store`, `admin_set_billing_mode`.
- Drop tables (now unused): `subscription_payments`, `subscriptions`, `store_plan_assignments`, `plans`.
- Update `is_store_commission_mode()` to always return `true` (kept for backward compatibility with existing call sites — easier than ripping out all references).
- Change `stores.billing_mode` default to `'commission'`; add CHECK constraint allowing only `'commission'`.
- Update `handle_new_store` trigger / store creation defaults to auto-insert a 3% commission config row.

### 2. Edge functions
- Delete: `assign-store-plan`, `billing-cron`, `cashfree-create-order`, `cashfree-verify-payment`, `cashfree-webhook` (these are subscription-only; the *storefront* `store-cashfree-create-order` and `wallet-cashfree-create-order` stay).
- Unschedule any `billing-cron` pg_cron job.

### 3. Frontend removal
- **Delete files:** `src/hooks/useBillingState.ts`, `src/components/BillingPaywall.tsx`, `src/components/billing/BillingBanner.tsx`, `src/components/billing/BillingSection.tsx`, `src/pages/admin/AdminSubscriptions.tsx`.
- **Edit to strip subscription references:**
  - `src/layouts/DashboardLayout.tsx`, `src/pages/Dashboard.tsx`, `src/pages/CartPage.tsx`, `src/pages/V22CartPage.tsx`, `src/pages/ProductDetail.tsx`, `src/pages/V22ProductDetail.tsx`, `src/components/storefront/SideCart.tsx`, `src/pages/UserSettings.tsx`, `src/pages/StorePayments.tsx` — remove `BillingPaywall`, `useBillingState`, suspended-state gating.
  - `src/components/AppSidebar.tsx`, `src/components/AdminSidebar.tsx`, `src/components/AdminBreadcrumbs.tsx`, `src/components/AdminCommandPalette.tsx`, `src/layouts/AdminLayout.tsx`, `src/routes/AuthRoutes.tsx` — remove Subscriptions/Billing nav and routes.
  - `src/components/admin/ManageStoreDialog.tsx`, `src/pages/admin/AdminUsersStores.tsx`, `src/pages/admin/AdminWallets.tsx`, `src/pages/admin/AdminPartners.tsx` — remove plan-assignment UI; keep commission % editor.
  - `src/pages/CreateStore.tsx` — drop plan selection; commission row auto-created via trigger.
  - `src/hooks/useMyStore.ts`, `src/hooks/useStoreData.ts`, `src/hooks/useRealtimeStore.ts` — drop subscription joins/fields.
- **Landing & legal copy:** Strip pricing/plan/trial messaging from `landing/Pricing.tsx`, `landing/Hero.tsx`, `landing/FAQ.tsx`, `landing/StickyMobileCTA.tsx`, `landing/StartRiskFree.tsx`, `landing/SolutionFlow.tsx`, `landing/FinalCTA.tsx`, `landing/AfterYouStart.tsx`, `landing/ExitIntentPopup.tsx`, `landing/LandingJsonLd.tsx`, `landing/v2/*` (`PricingV2`, `ProblemVsUs`, `SavingsCalculator`). Replace with "Free to start • 3% commission per order" messaging. (No specific ₹ prices per project memory.)
  - Legal pages (`TermsAndConditions`, `RefundPolicy`, `PrivacyPolicy`, `ShippingPolicy`, `ContactUs`, `StorefrontPrivacyPolicy`, `defaultPageContent`) — rewrite subscription/refund clauses to commission terms.
- **Guides/content:** Update `src/content/guides.ts`.

### 4. Super-admin commission management (kept & polished)
- `AdminWallets` already lists wallets + ledger — keep.
- Add a small "Set commission %" inline editor on `AdminUsersStores` / `ManageStoreDialog` that writes to `store_commission_config` (default 3%).
- Replace the Subscriptions sidebar entry with "Commissions" pointing to the existing wallets/commissions view.

### 5. Verification
- Run typecheck (auto). Smoke: load `/dashboard`, `/admin/wallets`, storefront cart — no `BillingPaywall` mounts, no `useBillingState` calls, no broken imports.
- DB: confirm no row remains in `plans`/`subscriptions`/`store_plan_assignments`; every store has a `store_commission_config` row at 3%.

## Notes / Risks
- Migration drops 4 tables — irreversible. `subscriptions` is already empty; `store_plan_assignments` (17 rows) and `subscription_payments` are legacy. Confirming this is OK before I run the migration.
- Cashfree subscription functions removed do **not** touch storefront order payments.
- `is_store_commission_mode()` kept as `RETURN true` to avoid touching every call site in one pass.

## Technical sequence
1. Supabase migration (data backfill + drops + new defaults).
2. Delete edge functions.
3. Delete + edit frontend files in parallel batches.
4. Landing/legal copy rewrite.
5. Final typecheck and dashboard smoke.

Confirm and I'll execute — especially: OK to drop `plans`, `subscriptions`, `subscription_payments`, `store_plan_assignments` permanently?
