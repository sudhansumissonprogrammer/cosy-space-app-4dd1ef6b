## Goal

Now that `ManageStoreDialog` is the single source of truth for per-store admin (Overview, Billing, Wallet, Danger), strip the old duplicate UI from the four admin pages so there is zero overlap, and fix bugs found during the audit.

## Issues found

### 1. Overlapping/duplicate UI (built before ManageStoreDialog, now redundant)


| Page                     | Duplicate to remove                                                                                                      | Why redundant                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AdminWallets.tsx`       | `AdjustDialog` (Adjust button) and `ConfigDialog` (Config button) — lines 185–288                                        | ManageStoreDialog → Wallet tab does the exact same adjust + commission-config                                                                                                 |
| `AdminSubscriptions.tsx` | `StoreOverrideDialog` (Edit button) and `BillingActions` (+30d / ⏸) — lines 332–537, 677–736                             | ManageStoreDialog → Billing tab covers plan, custom name/price/limit, free-lifetime, one-time, status, period dates, notes. Quick +30d/suspend are confusing duplicates       |
| `AdminUsersStores.tsx`   | Billing-mode toggle badge in the "Billing" column — lines 247–268; also `setBillingMode` mutation + `billingModes` query | ManageStoreDialog → top bar already switches mode atomically and parks subscription. Inline toggle bypasses parking → can desync with `store_plan_assignments.billing_status` |
| `AdminUsersStores.tsx`   | Verify badge inline toggle (lines 233–245)                                                                               | Lives in Manage → Danger. Keep column as **read-only badge** for at-a-glance, drop the click-to-toggle                                                                        |
| `AdminStores.tsx`        | Verify badge inline toggle, inline Suspend AlertDialog                                                                   | Manage → Danger owns these                                                                                                                                                    |


Quick actions worth keeping in tables: **Open Dashboard**, **Delete store** (destructive, useful one-click), **Block/Unblock user** in AdminUsersStores (acts on user, not store).

### 2. Bug: AdminStores column header/body mismatch

`AdminStores.tsx` headers (lines 119–127) declare: Store, Slug, Owner ID, Status, **Verified, Created**, actions.
Body (lines 130–156) renders in order: Store, Slug, Owner ID, Status, **Created (line 147), Verified (line 149–156)**, actions.
→ Verified value renders under "Created" header and vice-versa. Swap to match.

### 3. Bug: AdminUsersStores re-fetches `billing_mode` separately

`get_admin_users_stores` RPC returns rows without `billing_mode`, so a second query `admin-store-billing-modes` is fired and joined client-side. Since the inline mode toggle is being removed (issue #1), drop the second query entirely and read `billing_mode` from a single small fetch only if a column still needs it. We can keep a tiny `stores.select("id, billing_mode")` if we want a read-only "Billing" badge column, or drop the column entirely (cleaner — billing mode is visible inside Manage).

### 4. ManageStoreDialog small polish

- `OverviewTab` "Open dashboard" link uses `/dashboard/stores/{slug}/products` — same pattern as AdminUsersStores. OK.
- `WalletPanel.balance_after` is rendered but `wallet_charge_order`/`wallet_adjust` ledger rows may not have `balance_after`. Verify field exists in `store_wallet_ledger`; if not, hide the column.
- Mode-switch buttons disable correctly (good).

## Changes

### A. `src/pages/admin/AdminWallets.tsx`

- Delete `AdjustDialog` and `ConfigDialog` components (lines 185–288) and remove their imports/usage.
- Action column = single **Manage** button.
- Remove unused icons (`Plus`, `Minus`, `Settings2` only if no other use).

### B. `src/pages/admin/AdminSubscriptions.tsx`

- Delete `StoreOverrideDialog` (lines 332–538) and `BillingActions` (lines 677–736) components.
- In `StorePlansSection` row actions for subscription-mode stores, keep only **Manage**.
- Commission-mode row already has only Manage — no change.
- Remove now-unused imports (`Dialog*`, `Switch`, `Textarea`, `Pencil` if unused).

### C. `src/pages/admin/AdminUsersStores.tsx`

- Remove `setBillingMode` mutation and `billingModes` query.
- Drop the "Billing" column entirely (it's visible inside Manage and avoids the extra query).
- Verified column → read-only badge (no onClick).
- Keep: Manage, Open Dashboard, Block/Unblock user, Delete store. Remove inline Suspend (lives in Manage → Danger).

### D. `src/pages/admin/AdminStores.tsx`

- Fix column order: swap so body matches header (Verified before Created), or reorder header to match body — pick one consistent order: **Store, Slug, Owner ID, Status, Verified, Created, actions**, and reorder TableCells accordingly.
- Keep Manage + Delete only. Remove inline Suspend AlertDialog and Verify badge toggle.

### E. `src/components/admin/ManageStoreDialog.tsx`

- Confirm `store_wallet_ledger.balance_after` column exists; if not, drop that `TableCell`/`TableHead`.
- Minor: when `defaultTab="wallet"` but store is in subscription mode, fall back to `billing` (avoid landing on a disabled tab).

## Out of scope

- No schema changes; all RPCs and policies already support every action.
- No edge-function changes; `admin-wallet-controls` already handles `set_billing_mode`, `update_config`, `wallet_adjust`, `get_summary`.

## Verification

1. Open each admin page → confirm a single **Manage** button per row, no duplicate Edit/Config/+30d controls.
2. AdminStores: Status, Verified, Created columns line up with their headers.
3. Open Manage → Billing tab swaps Subscription ⇄ Commission form correctly; switching mode parks subscription as `lifetime` (commission) or restores `active`.
4. Wallet adjust + commission-config save and reflect immediately in `AdminWallets` row totals. do all safely