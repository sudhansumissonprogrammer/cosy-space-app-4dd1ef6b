# Commission Logic — Revised Rules

## New behavior (what you asked for)

**Earning statuses** = `confirmed`, `shipped`, `delivered`, `partially_paid`
**Non-earning statuses** = `pending`, `cancelled` (and anything else)

Rules:
1. When an order **first enters** any earning status → deduct commission **once**.
2. If commission was already charged for that order → **never charge again** (idempotent).
3. If order is created directly as pending/cancelled → **no deduction**.
4. If order is moved from an earning status → **no refund**, **no re-deduction** if moved back.
5. If a pending/cancelled order is later moved to an earning status → deduct once (rule 1).
6. Partially_paid → fully paid (or any earning → earning movement) → **no extra charge** (already charged).

In short: **one charge per order, ever. Triggered by the first time status becomes earning. No refunds.**

## Changes

### 1. DB migration — replace `tg_order_commission_handler`

```text
INSERT:
  if NEW.status in (confirmed, shipped, delivered, partially_paid):
    wallet_charge_order(NEW.id)   -- idempotent, no-op if already charged

UPDATE (on status change):
  if NEW.status in earning set AND no prior 'charged' row exists:
    wallet_charge_order(NEW.id)
  -- no reversal branch, ever
```

`wallet_charge_order` already short-circuits when `store_order_commissions.status = 'charged'`, so re-entering an earning status after being cancelled won't double-charge.

### 2. Drop reversal trigger path

Keep `wallet_reverse_order_commission` function in DB (harmless), but the trigger will no longer call it. No automatic refunds anywhere.

### 3. Ledger notes

Update the debit note from `"Commission X% on delivered order …"` to `"Commission X% on order …"` since it's no longer delivered-only.

## What stays the same

- `StoreWallet.tsx` already shows per-order debits — no UI change needed.
- `StoreOrders.tsx` status filter (already includes pending) — no change.
- `place-order` edge function — no change (COD orders insert as `confirmed`, which will now charge immediately on insert per rule 1; this matches your intent).
- `store_order_commissions` idempotency table — unchanged, prevents double-charge.

## Edge case verification

| Scenario | Behavior |
|---|---|
| New COD order → inserted as `confirmed` | Charge once ✅ |
| New online order → inserted as `pending`, paid → `confirmed` | Charge once on transition ✅ |
| `pending` → `cancelled` | No charge ✅ |
| `confirmed` → `cancelled` | Already charged, no refund ✅ |
| `cancelled` → `confirmed` (re-activated) | Already charged → no-op ✅ |
| New order created directly as `cancelled` | No charge ✅ |
| `partially_paid` → `delivered` | Already charged → no-op ✅ |
| Delivered → returned/cancelled | No refund ✅ |

## Non-technical summary

- You pay commission **exactly once** the moment an order becomes a real sale (confirmed / shipped / delivered / partially paid).
- Pending and cancelled orders **never** cost you anything.
- Once charged, the money is locked in — cancelling later won't refund, but moving the order around won't charge again either.
- This stops the situations you saw (charge on cancelled order, charge on pending order, surprise refunds, double charges).
