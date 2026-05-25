## Audit — what's already correct vs leaking

I traced every place the owner dashboard renders subscription/billing UI and compared against `stores.billing_mode`.

**Already correct (commission mode is respected):**
- `AppSidebar.tsx` — "Wallet" menu item only appears when `billing_mode === "commission"`.
- `DashboardLayout.tsx` — the paywall (`BillingPaywall`) is bypassed when commission mode (`!isCommissionMode` guard on `billingBlocked`).
- `StoreWallet.tsx` — page itself gates to commission and shows a "Wallet is only for commission stores" message otherwise.

**Leaks (subscription UI still shown to commission stores):**

1. **`BillingBanner`** (rendered in `DashboardLayout` for both desktop + mobile)
   Does its own `stores → id` query and reads `useBillingState`. It does **not** check `billing_mode`. For a commission store, `billing_state.billing_status` can still be `trialing` / `past_due`, so the yellow/red "Pay Now" strip keeps appearing at the top of every dashboard page.

2. **`UserSettings.tsx` → `<BillingSection />`**
   Renders unconditionally. For commission stores it shows the "Billing & Subscription" card with plan name, "Pay ₹X/mo" button and subscription payments history — none of which apply.

3. **`UserSettings.tsx` → "Current Plan" card**
   Shows `storePlanAssignment` / `subscription` plan info. Meaningless in commission mode (plan is "parked as lifetime" by the admin dialog).

4. **No wallet summary on Account/Profile** — commission owners can only see balance by navigating to `/dashboard/stores/:slug/wallet`. The Account page (which is also where the paywall redirects users) has zero wallet context.

5. **`userStore` query in `UserSettings`** only selects `id` — has no `billing_mode`, so we can't gate without extending it.

## Plan

### A. Make `BillingBanner` billing-mode aware
- Extend the inner `stores` select to `id, billing_mode`.
- Early-return `null` when `billing_mode === "commission"`.
- (Optional cleanup) Reuse `useMyStore` instead of running a parallel query — same payload is already cached.

### B. Extend `UserSettings.userStore` query
- Select `id, slug, billing_mode` (still cheap).
- Derive `isCommissionMode` once.

### C. Hide subscription UI on Account page when commission
- Conditionally render `<BillingSection />` only when `!isCommissionMode`.
- Conditionally render the "Current Plan" card only when `!isCommissionMode`.

### D. Add a `WalletAccountCard` on the Account page (commission mode only)
A compact card placed where `BillingSection` used to be, showing:
- Current balance (red if negative / amber if below `low_balance_threshold`)
- Total recharged, total commission paid
- Commission %, min recharge
- "Recharge wallet" button → reuses the same Cashfree flow already in `StoreWallet.tsx`
- "View full history" link → `/dashboard/stores/:slug/wallet`

Implementation: factor the recharge dialog + `get_store_wallet_summary` query out of `StoreWallet.tsx` into a small shared component (`src/components/billing/WalletAccountCard.tsx`) used by both `UserSettings.tsx` and `StoreWallet.tsx` so behaviour stays in sync.

### E. Verify no other leaks
Grep confirms the only subscription-leaning UI inside the owner dashboard surface is `BillingBanner`, `BillingPaywall`, `BillingSection`, and the Account page's "Current Plan" card. All four are handled above. Sidebar, paywall, and StoreWallet page are already mode-aware. Nothing else in `src/pages/dashboard/**` or `src/components/dashboard/**` references billing/subscription.

### Files touched

- `src/components/billing/BillingBanner.tsx` — add `billing_mode` to inner query, early-return when commission.
- `src/pages/UserSettings.tsx` — fetch `billing_mode + slug`, gate `BillingSection` and "Current Plan" card, render `WalletAccountCard` when commission.
- `src/components/billing/WalletAccountCard.tsx` (**new**) — extracted balance card + recharge dialog reusing existing edge functions (`wallet-cashfree-create-order`, `wallet-cashfree-verify`).
- `src/pages/StoreWallet.tsx` — replace duplicated balance card + recharge dialog with `<WalletAccountCard variant="full" />` (keeps the long ledger list below); pure refactor, no behaviour change.

### Out of scope
- No DB / RPC / edge-function changes — `get_store_wallet_summary` already returns everything needed.
- No admin-side changes — those were finished in the previous loop.
- No change to subscription-mode UX (stays exactly as today).
