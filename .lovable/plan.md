

## Plan: Dual Order Mode (WhatsApp vs Website Checkout)

### Overview
Add an "Order Mode" choice during store creation. If the store owner picks **WhatsApp**, the current flow stays. If they pick **Website**, customers see a "Buy Now" button that opens a checkout page with address fields and COD payment, and the order appears in both the store owner's and admin's order views.

---

### Database Changes (2 migrations)

**Migration 1: Add `order_mode` to `stores`**
```sql
ALTER TABLE public.stores ADD COLUMN order_mode text NOT NULL DEFAULT 'whatsapp';
```

**Migration 2: Add address/payment columns to `orders` table**
The existing `orders` table (with `store_id`, `total`, `status`, `customer_id`, `notes`) will be extended:
```sql
ALTER TABLE public.orders
  ADD COLUMN customer_name text,
  ADD COLUMN customer_phone text,
  ADD COLUMN street_address text,
  ADD COLUMN city text,
  ADD COLUMN state text,
  ADD COLUMN pincode text,
  ADD COLUMN payment_method text NOT NULL DEFAULT 'cod';
```

Also add a public INSERT policy on `orders` and `order_items` so unauthenticated storefront visitors can place orders:
```sql
CREATE POLICY "Anyone can create website orders"
  ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create website order items"
  ON public.order_items FOR INSERT WITH CHECK (true);
```

---

### File Changes

**1. `src/pages/CreateStore.tsx`**
- Add `order_mode` state (`'whatsapp' | 'website'`), default `'whatsapp'`.
- In Step 1 (Store Info), add a radio group: "How do you want to take orders?"
  - **Order via WhatsApp** (Take orders via WhatsApp)
  - **Order via Website** (Customers checkout on your site)
- If `order_mode === 'whatsapp'`, keep the WhatsApp number field required in Step 3.
- If `order_mode === 'website'`, WhatsApp number becomes optional.
- Include `order_mode` in the insert payload.

**2. `src/pages/ProductDetail.tsx`**
- Check `store.order_mode`.
- If `'whatsapp'` and store has WhatsApp number: show current `WhatsAppOrderButton`.
- If `'website'`: show a **"Buy Now"** button that navigates to `/store/:slug/checkout?product=:productId&variant=:variantId`.

**3. New file: `src/pages/CheckoutPage.tsx`**
- Reads `product` (and optional `variant`) from URL query params.
- Fetches product details from database.
- Shows a checkout form:
  - Full Name, Phone, Street Address, City/Town, State, Pincode
  - Payment Method: COD (default, read-only for now)
  - Order summary (product name, price, quantity)
- On "Place Order":
  1. Insert into `orders` table (store_id, total, customer_name, customer_phone, street_address, city, state, pincode, payment_method, status='pending').
  2. Insert into `order_items` table (order_id, product_id, product_name, quantity, unit_price, total).
  3. Also insert into `customer_leads` for lead tracking.
  4. Show success confirmation page.

**4. `src/App.tsx`**
- Add route: `/store/:slug/checkout` -> `CheckoutPage` (inside `StorefrontLayout`).

**5. `src/pages/StoreOrders.tsx`**
- Add a tabs UI ("WhatsApp Orders" | "Website Orders").
- Website Orders tab queries `orders` + `order_items` tables joined, showing customer name, phone, full address, payment method, status, and date.
- Add status update dropdown for website orders too.

**6. `src/pages/admin/AdminOrders.tsx`**
- Add tabs for "WhatsApp Orders" and "Website Orders".
- Website Orders tab queries `orders` table with store name join, showing all address details, payment method, status.

**7. `src/pages/StoreSettings.tsx`**
- Allow editing `order_mode` in store settings so owners can switch later.

---

### Flow Summary

```text
Store Creation
  └─ Pick: WhatsApp or Website

Storefront Product Page
  ├─ WhatsApp mode → "Order on WhatsApp" (existing)
  └─ Website mode  → "Buy Now" → /store/:slug/checkout
                        └─ Form: name, phone, address, city, state, pincode
                        └─ Payment: COD (default)
                        └─ "Place Order" → saves to orders + order_items
                        └─ Success page

Dashboard Orders
  ├─ WhatsApp Orders tab (existing whatsapp_orders)
  └─ Website Orders tab (orders + order_items)

Admin Orders
  ├─ WhatsApp Orders tab
  └─ Website Orders tab (full address details visible)
```

