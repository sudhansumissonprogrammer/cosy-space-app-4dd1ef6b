## Plan to fix all order status mismatch

### Root causes found
- The database has one real order status (`orders.status`), but some UI parts still make their own interpretation.
- Storefront order list cache stays fresh for 10 minutes, so the order card can show old `pending` while order detail refetches and shows `partially_paid`.
- Storefront order detail payment text uses `payment_type === "partial"` to show `Partially Paid`, even when the actual order status is still `pending` and payment is not verified yet.
- Dashboard mobile detail sheet keeps a local copy of the order; after a status change, it can temporarily differ from the main list until refetch finishes.
- Some labels still render raw status text like `partially_paid` / `Partially_paid` instead of the shared status label.

### Fixes to implement

1. **Make `src/lib/orderStatus.ts` the only status source**
   - Export shared status options for dropdowns/filters.
   - Use `orderStatusLabel()` everywhere instead of `s.charAt(0) + s.slice(1)`.
   - Add safe handling for backend/legacy statuses like `failed` so unknown statuses never fall back to `Pending` incorrectly.

2. **Fix storefront order card vs detail stale cache**
   - Reduce/refetch the `storefront-customer-orders` query so order cards refresh when opened/focused.
   - Add a customer-order realtime subscription or focused invalidation so dashboard status changes (`pending → partially_paid → confirmed → shipped → delivered`) update customer order cards and detail quickly.
   - When detail loads from list cache, keep the instant render but force fresh DB status immediately.

3. **Fix storefront order detail payment wording**
   - Separate fulfillment status from payment status:
     - `status = pending` + `payment_type = partial` + not verified: show order status `Pending`, payment text `Advance payment pending`.
     - `status = partially_paid`: show order status `Partially Paid`, payment text `Advance paid`.
     - `status = confirmed/shipped/delivered`: show that exact order status everywhere; payment block can still show advance/balance only as payment details, not as order status.
   - Add a visible shared status badge/title in order detail, not only the timeline step, because `partially_paid` maps to the Confirmed step but should still label as `Partially Paid`.

4. **Fix dashboard order page live consistency**
   - Use optimistic cache updates when merchant changes status from dropdown, mobile sheet, swipe-to-ship, or bulk update.
   - Update both dashboard list and open mobile detail sheet immediately from the same mutation result.
   - Replace raw dropdown/filter labels with shared labels (`Partially Paid`, `Confirmed`, `Shipped`, etc.).
   - Fix the “Mark as Fully Paid” mobile action so it updates status + balance in one path and does not double-update or leave stale balance/status in the sheet.

5. **Fix invoice/recent order/status surfaces**
   - Replace remaining invoice/local status color maps with shared status label/classes where applicable.
   - Keep dashboard Recent Orders, order table, mobile order cards, storefront order cards, storefront detail, public tracking, and invoices all using the same label/color rules.

### Expected result
- If payment gateway verifies partial payment: dashboard, order card, order detail, tracking, invoice all show `Partially Paid`.
- If store owner changes it to `Confirmed`: every surface shows `Confirmed`.
- If store owner changes it to `Shipped` or `Delivered`: every surface updates to that status.
- If a partial payment order is still truly `Pending`, storefront detail will no longer say `Advance paid`; it will show `Pending` and `Advance payment pending`.
- No overlapping/conflicting status labels between dashboard and storefront.