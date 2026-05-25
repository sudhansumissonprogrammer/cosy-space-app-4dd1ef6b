
# Per-Store Admin Management Dialog

Goal: from `/admin/users-stores` (and `/admin/stores`), clicking a store opens **one unified panel** that shows everything for that store and lets you switch between **Subscription** and **Commission** billing — with the right config visible for whichever mode is on. No overlap, no conflicts.

## What the user sees

Click a store row → "Manage Store" dialog (large, tabbed) opens.

```text
┌─ Manage Store: Metrobazaar (/metrobazaar) ─────────────────┐
│ Owner: demo@gmail.com   Created: Apr 26   [Visit ↗]        │
│                                                            │
│ Billing Mode:  ( ) Subscription   (•) Commission   [Save]  │
│ ─────────────────────────────────────────────────────────  │
│ [Overview] [Billing] [Wallet] [Danger]                     │
│                                                            │
│  ── Overview tab ──                                        │
│   Products: 4  Orders: 0  Customers: 0  Status: Active     │
│   Verified: No   Suspended: No                             │
│                                                            │
│  ── Billing tab (changes by mode) ──                       │
│   IF subscription:                                         │
│     • Current plan + custom name/price/product limit       │
│     • Status (trialing/active/past_due/suspended/lifetime) │
│     • Trial end / period end / grace end (editable)        │
│     • Mark as free-lifetime toggle                         │
│     • Recent subscription payments (last 10)               │
│   IF commission:                                           │
│     • Commission % (editable, default 3)                   │
│     • Min recharge (₹) (editable, default 700)             │
│     • Low-balance threshold (editable, default 100)        │
│     • Active toggle                                        │
│                                                            │
│  ── Wallet tab (commission mode only) ──                   │
│     Balance  Total recharged  Total charged                │
│     [Credit ₹] [Debit ₹] with note                         │
│     Last 50 ledger entries (date / kind / amt / balance)   │
│     Last 20 recharges (date / amt / status)                │
│                                                            │
│  ── Danger tab ──                                          │
│     Suspend / Unsuspend store                              │
│     Verify / Unverify                                      │
│     Block / Unblock owner                                  │
└────────────────────────────────────────────────────────────┘
```

The **Billing tab body swaps entirely** based on `stores.billing_mode` — subscription fields are hidden in commission mode and vice-versa, so there is zero visual overlap.

## What this replaces / consolidates

- The "Edit Config" dialog on `/admin/wallets` → still works there, but is now also reachable from the per-store dialog.
- The "Store Plans" tab on `/admin/subscriptions` → still exists for bulk view, but per-store editing happens in the dialog (single source of truth).
- The wallet adjust/config flows already exist as the `admin-wallet-controls` edge function — we just call it from the new dialog.

## Implementation (technical)

**New file: `src/components/admin/ManageStoreDialog.tsx`**
- Props: `{ storeId, open, onOpenChange }`.
- Data sources (all in one `useQuery`):
  - `admin-wallet-controls` `get_summary` action → returns `store`, `wallet`, `config`, `ledger`, `recharges`.
  - `store_plan_assignments` row + `plans` join → for subscription tab.
  - `subscription_payments` last 10 → recent payments.
- Mutations (all via existing endpoints, no new edge fns):
  - **Mode switch** → `admin-wallet-controls` `action: set_billing_mode`.
  - **Commission config** → `action: update_config`.
  - **Wallet credit/debit** → `action: wallet_adjust`.
  - **Subscription edit** (custom price/name/limit, status, trial/period/grace, is_free_lifetime) → direct `supabase.from('store_plan_assignments').update()` (admin RLS already allows).
  - **Suspend / verify / block** → existing `stores` / `profiles` updates.

**Wire-up:**
- `AdminUsersStores.tsx`: make the store cell clickable → opens dialog with that `store_id`. Keep the existing inline suspend/verify buttons.
- `AdminStores.tsx`: same — store row click opens the dialog.
- `AdminWallets.tsx`: row click opens the dialog (Wallet tab focused).
- `AdminSubscriptions.tsx` → `StorePlansSection`: row "Manage" button opens the dialog (Billing tab focused).

**Backend changes needed:** none. Every RPC / edge action / RLS policy required already exists from prior turns (`admin_set_billing_mode`, `wallet_adjust_store`, `store_commission_config` upsert, admin SELECT on `stores`/`store_plan_assignments`).

**Conflict-avoidance guarantees:**
- Mode switch already calls `admin_set_billing_mode` which atomically flips `billing_status` between `'lifetime'` (commission parks the subscription) and `'active'` — paywall + sidebar + banners already key off `billing_mode`, so the dialog's Save is the only state mutation needed.
- Billing-tab body renders only the section matching current `billing_mode` → no overlap.
- Wallet tab disabled / hidden when `billing_mode = 'subscription'`.

## Out of scope (will not touch)

- Order/commission charge logic (already correct).
- Cron / paywall (already mode-aware).
- Adding new tables or new edge functions.

## File list

- Create: `src/components/admin/ManageStoreDialog.tsx`
- Edit: `src/pages/admin/AdminUsersStores.tsx` (open dialog on row click)
- Edit: `src/pages/admin/AdminStores.tsx` (open dialog on row click)
- Edit: `src/pages/admin/AdminWallets.tsx` (open dialog on row click, default tab=wallet)
- Edit: `src/pages/admin/AdminSubscriptions.tsx` (replace per-row edit with dialog open, default tab=billing)
