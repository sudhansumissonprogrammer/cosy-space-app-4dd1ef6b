

# Partial Payment (Advance + COD Balance) Feature

## Overview
Add a per-product partial payment option so store owners can require an advance online payment via Razorpay, with the remaining balance collected as COD on delivery.

## Database Changes (1 migration)

**Products table** -- add 3 columns:
- `partial_payment_enabled` (boolean, default false)
- `partial_payment_type` (text, default 'percentage') -- 'fixed' or 'percentage'
- `partial_payment_value` (numeric, default null) -- the fixed amount or percentage

**Orders table** -- add 3 columns:
- `payment_type` (text, default 'full') -- 'full' or 'partial'
- `advance_paid` (numeric, default 0) -- amount paid online
- `balance_due` (numeric, default 0) -- remaining COD amount

## Files to Modify

### 1. ProductForm.tsx (Store Owner Config)
- Add a "Partial Payment" section after the price fields
- Toggle to enable partial payment
- Radio: Fixed ₹ or Percentage %
- Input for value with validations:
  - Percentage max 80%, min 10%
  - Fixed amount must be less than product price and > ₹50
- Only show when store has Razorpay enabled (order_mode is 'website' or 'both')

### 2. ProductDetail.tsx (Customer-Facing Display)
- When product has partial payment enabled, show badge: "Pay ₹X now, ₹Y on delivery"
- Calculate advance from product price based on type/value
- Pass partial payment info to checkout via URL params

### 3. CheckoutPage.tsx (Checkout Flow)
- When any item has partial payment enabled, show two payment options:
  - "Pay Full Amount" 
  - "Pay Advance Only (₹X now + ₹Y COD)" -- highlighted/recommended
- When partial selected:
  - Only charge advance amount through Razorpay
  - Show clear breakdown: Advance online + Balance on delivery
- Update `createOrder` to pass `payment_type`, `advance_paid`, `balance_due`

### 4. place-order Edge Function
- Accept new fields: `payment_type`, `advance_paid`, `balance_due`
- Server-side recalculation of advance amount from product data (don't trust frontend)
- Store values in orders table

### 5. razorpay-order Edge Function
- Accept the charge amount (advance or full) -- already works with any amount

### 6. StoreOrders.tsx (Order Management)
- Show "Partially Paid" badge for partial orders
- Display advance paid vs balance due in order detail
- Add "Mark as Fully Paid" action for delivered partial orders
- Add `partially_paid` to status color map

### 7. Order Success Page (in CheckoutPage.tsx)
- Show partial payment breakdown: "Advance Paid: ₹X | Balance on Delivery: ₹Y"

### 8. StorefrontAccount (Order Tracking)
- Show partial payment status and remaining balance

## Calculation Logic (Server-Side)
```text
For each cart item with partial_payment_enabled:
  if type == 'percentage':
    advance = item.price * (value / 100)
  else:
    advance = min(value, item.price)
  
  advance = max(advance, 50)  // minimum ₹50 advance
  
Items without partial payment: advance = full price

total_advance = sum of all item advances
balance_due = total - total_advance
```

## Security
- Server recalculates advance from DB product data, not frontend values
- Razorpay only charges the advance amount
- Order stores both advance_paid and balance_due for audit

## UX Flow
1. Store owner enables partial payment on a product with value
2. Customer sees "Pay ₹200 now, ₹800 on delivery" on product page
3. At checkout, partial payment is pre-selected (recommended)
4. Customer can switch to full payment if preferred
5. On placing order, only advance goes through Razorpay
6. Order shows as "Partially Paid" with breakdown
7. Store owner marks as "Fully Paid" after delivery collection

