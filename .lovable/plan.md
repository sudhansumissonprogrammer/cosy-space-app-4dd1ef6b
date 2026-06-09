# Premium Order Detail Page (Flipkart-style)

Transform the Orders tab on the storefront account from a single dense list into a clean **clickable order card list + dedicated order detail page** — like Flipkart / Myntra / Amazon.

## What changes

### 1. Orders list (inside `/account` → Orders tab)

Each order becomes a slim, tappable card showing only the essentials:

- First product image (or stacked thumbnails if multiple items)
- Product name (`+N more` if multiple items)
- Status pill (Confirmed / Shipped / Delivered / Cancelled) with colored dot
- Order total + date on the right
- Chevron → opens the full detail page
- One short status line ("Delivered on 5 Jun" / "Arriving by 12 Jun" / "Cancelled")

No timelines, no item breakdown, no buttons on the card. Pure summary. Tap to open detail.

### 2. New Order Detail page → `/account/orders/:orderId`

Premium, sectioned layout (sticky header, generous spacing, soft dividers):

**a. Header**

- Back button
- Order ID short code + placed date
- Status pill

**b. Tracking timeline** (horizontal stepper)
Placed → Confirmed → Shipped → Out for Delivery → Delivered

- Current step highlighted with primary color + filled dot + pulse ring
- Each step shows date/time when reached
- Cancelled state replaces the strip with a red "Order Cancelled on …" banner
- If `tracking_number` exists → courier line + "Track Package" external link

**c. Items section**
Each item row: large thumbnail, name, variant (size/color if any), qty, unit × qty = total. Tap thumbnail → product page. Per-item action buttons appear here based on status:

- **Cancel item** (status `pending`/`confirmed`) — opens reason picker (Changed mind / Found cheaper / Wrong item / Other)
- **Return item** (status `delivered`, within 7 days) — opens reason + optional note
- **Buy Again** (status `delivered`/`cancelled`) — re-adds to cart

**d. Delivery address card**
Name, full address, phone. Plain readable block, no edit.

**e. Payment details card**

- Payment method (UPI / Card / COD / Cashfree / Razorpay) with icon
- Payment status (Paid / COD / Partially Paid)
- Price breakdown: Items subtotal, Shipping, Discount, Tax, **Total Paid**
- Partial-payment block (advance + balance due) when applicable

**f. Action bar (sticky on mobile, inline on desktop)**

- **Download Invoice** (reuses existing `OrderInvoice` component → PDF)
- **Need Help?** → WhatsApp / call store
- **Cancel Order** (full order, only if no item-level cancel happened and status allows)

### 3. Cancel & Return flow

- **Cancel**: existing mutation, but with a reason dropdown saved to a new `cancel_reason` text column on `orders` (nullable, optional). If column add feels heavy we can store inside existing `notes`/`metadata` — I'll confirm before migrating.
- **Return**: writes a row to a new `order_returns` table (order_id, item_id nullable, reason, note, status='requested', created_at) — OR if you want zero schema change, opens a WhatsApp deep link to the store with a prefilled return request message. **I'll ask which you prefer before implementing.**

### 4. Invoice download

"Download Invoice" button opens the existing `OrderInvoice` modal which already has print/PDF — wire it up on the detail page.

## Files

- **New**: `src/pages/StorefrontOrderDetail.tsx` — the detail page
- **New**: `src/components/storefront/OrderStatusTimeline.tsx` — horizontal stepper
- **New**: `src/components/storefront/OrderCard.tsx` — compact list card
- **Edit**: `src/pages/StorefrontAccount.tsx` — replace inline order rendering with `OrderCard` list, each linking to detail page
- **Edit**: `src/App.tsx` — add route `account/orders/:orderId` → `StorefrontOrderDetail`
- **Reuse**: `src/components/OrderInvoice.tsx` for invoice modal

## Design language

- Matches existing storefront theme tokens (`--storefront-text`, `--storefront-bg`, primary)
- Soft rounded cards (rounded-2xl), thin borders via color-mix, generous padding
- Status colors: amber (pending), blue (confirmed), violet (shipped), emerald (delivered), red (cancelled)
- Mobile-first: full-width sections, sticky bottom action bar
- Desktop: 2-column at `lg` (left = items+tracking, right = address+payment+actions)
- Subtle motion: timeline dot pulse, card hover lift, fade-in on detail open
- No flashy gradients — calm, premium, Flipkart-clean

## Open questions before I build

1. **Returns**: create a real `order_returns` table, or just open WhatsApp with a prefilled "I want to return order #…" message? (Real table = trackable in dashboard; WhatsApp = zero backend work)
2. **Cancel reason**: save to DB (needs tiny migration) or just include reason in the WhatsApp notification to owner?
3. **Return window**: 7 days after delivery OK, or different?

Once you confirm these three, I'll implement in one shot. also use best posssible iconthere 