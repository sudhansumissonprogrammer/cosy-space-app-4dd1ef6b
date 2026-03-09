

## Plan: Order Mode & Razorpay Payment Integration

### Overview
Move "Order Mode" out of Store Settings into a new dedicated **"Orders & Payments"** page accessible from the sidebar. Add a third order mode ("Both"), and when Website or Both is selected, show payment configuration with COD and Razorpay options. Build full end-to-end Razorpay integration.

### Database Changes

**New table: `store_payment_config`**
- `id` (uuid, PK)
- `store_id` (uuid, unique, references logic via `is_store_owner`)
- `payment_methods` (jsonb) — e.g. `["cod", "razorpay"]`
- `razorpay_key_id` (text, nullable) — publishable key (safe for frontend)
- `razorpay_key_secret` (text, nullable) — secret key (used only in edge function)
- `created_at`, `updated_at`
- RLS: store owners can CRUD their own config

**Alter `stores` table:**
- Update `order_mode` to support three values: `whatsapp`, `website`, `both`

### New Sidebar Item

**`src/components/AppSidebar.tsx`**
- Add "Orders & Payments" menu item (with `CreditCard` icon) between "Coupons" and "Domain"
- Route: `/dashboard/stores/:storeId/payments`

### New Page: `src/pages/StorePayments.tsx`

A dedicated settings page with two sections:

**Section 1 — Order Mode** (moved from StoreSettings)
- Three radio options with icons:
  - WhatsApp — orders via WhatsApp message
  - Website — checkout on site (Buy Now)
  - Both — customers can choose either

**Section 2 — Payment Configuration** (shown only when mode is "website" or "both")
- **Cash on Delivery** toggle (always available, on by default)
- **Razorpay** toggle with expandable config (like the reference image):
  - Instructions box: "Get your Razorpay API Keys" with steps
  - Input: Razorpay Key ID (`rzp_live_xxx` or `rzp_test_xxx`)
  - Input: Razorpay Key Secret (masked)
  - Info: "2% fee per transaction - Cards, UPI, Net Banking, Wallets"
  - Keys stored in `store_payment_config` table

### Remove Order Mode from StoreSettings

**`src/pages/StoreSettings.tsx`**
- Remove the Order Mode radio group section
- Remove `orderMode` state and related code
- Keep saving other fields as-is

### Edge Function: `supabase/functions/razorpay-order/index.ts`

Creates a Razorpay order server-side:
- Input: `store_id`, `amount`, `currency`, `order_id` (our DB order ID)
- Fetches store's Razorpay keys from `store_payment_config`
- Calls Razorpay Orders API (`https://api.razorpay.com/v1/orders`)
- Returns `razorpay_order_id`, `key_id` to frontend

### Edge Function: `supabase/functions/razorpay-verify/index.ts`

Verifies payment after Razorpay checkout:
- Input: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`, `order_id`
- Fetches store's key_secret from `store_payment_config`
- Verifies signature using HMAC SHA256
- Updates order status to "confirmed" and payment_method to "razorpay"
- Returns success/failure

### Checkout Page Updates: `src/pages/CheckoutPage.tsx`

- Fetch `store_payment_config` for the store
- Show payment method selection based on configured methods:
  - COD (if enabled)
  - Razorpay (if enabled) — "Pay Online - Cards, UPI, Net Banking"
- If Razorpay selected:
  - On "Place Order": create order in DB → call `razorpay-order` edge function → load Razorpay checkout popup
  - On success: call `razorpay-verify` edge function → show success
  - On failure: show error, order stays pending

### Razorpay Frontend Integration

- Dynamically load `https://checkout.razorpay.com/v1/checkout.js`
- Open Razorpay modal with store's key_id, order amount, store name
- Handle `payment.success` and `payment.failed` callbacks

### Add Route

**`src/App.tsx`**
- Add: `<Route path="stores/:storeId/payments" element={<StorePayments />} />`

### File Summary

| File | Action |
|------|--------|
| DB migration | Create `store_payment_config` table with RLS |
| `src/pages/StorePayments.tsx` | New — order mode + payment config page |
| `src/components/AppSidebar.tsx` | Add "Orders & Payments" nav item |
| `src/pages/StoreSettings.tsx` | Remove order mode section |
| `src/App.tsx` | Add route for payments page |
| `supabase/functions/razorpay-order/index.ts` | New — create Razorpay order |
| `supabase/functions/razorpay-verify/index.ts` | New — verify Razorpay payment |
| `src/pages/CheckoutPage.tsx` | Add Razorpay payment option + flow |

