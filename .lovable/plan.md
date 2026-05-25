## Low Wallet Balance Recharge Popup (Commission Stores)

Add a blocking recharge popup on the dashboard for commission-mode stores whose wallet balance is below ₹100. It re-appears on every dashboard visit until balance ≥ ₹100.

### Behavior
- Only shows for stores where `billing_mode === "commission"`
- Triggers when `wallet_balance < 100`
- No close (X) button, no overlay click-to-dismiss, no ESC dismiss
- Single CTA: "Recharge Wallet" → navigates to `/dashboard/wallet` (or existing wallet recharge route)
- Reappears on every dashboard mount (no localStorage suppression) until balance crosses ₹100

### Implementation
- New component: `src/components/billing/LowBalanceDialog.tsx`
  - Uses existing `AlertDialog` (already non-dismissible by default — no `AlertDialogCancel`, only `AlertDialogAction`)
  - Title: "Recharge your wallet"
  - Message: explains balance is below ₹100 and new orders/commission deductions need a topped-up wallet
  - Action button routes to wallet recharge page
- Mount in `src/pages/Dashboard.tsx`:
  - Reuse existing `walletSummary` query (already fetched via `get_store_wallet_summary`)
  - Show dialog when `isCommissionMode && Number(walletSummary?.balance ?? 0) < 100`

### Files
- create `src/components/billing/LowBalanceDialog.tsx`
- edit `src/pages/Dashboard.tsx` (mount dialog)

No DB or backend changes.
