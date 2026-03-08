

# Plan: Implement 6 Missing Features

## Overview
Implement Share/QR Code, SEO meta tags, order status WhatsApp notifications, store business hours/location, product variants, and coupon/discount codes.

---

## 1. Share Store Link / QR Code

**What:** Add a "Share" button on store cards (StoresList) and storefront pages that opens a dialog with the store URL, a copy button, and a QR code.

**How:**
- Use a lightweight QR code library or generate QR via a free API (`https://api.qrserver.com/v1/create-qr-code/`)
- Add a `ShareStoreDialog` component with: copy-to-clipboard button, QR code image, and native Web Share API fallback for mobile
- Place the share button on `StoresList.tsx` store cards and in `StorefrontLayout.tsx` nav bar

---

## 2. SEO / Meta Tags per Store & Product

**What:** Dynamic `<title>`, `<meta description>`, and Open Graph tags for store and product pages.

**How:**
- Directly manipulate `document.title` and meta tags via a `useMetaTags` hook (no new dependency needed)
- In `StorefrontLayout.tsx`: set store name as title, description as meta description, logo as OG image
- In `ProductDetail.tsx`: set product name + store name as title, product description, product image as OG image

---

## 3. Order Status WhatsApp Notifications

**What:** When a store owner changes order status, send a WhatsApp message to the customer with the update.

**How:**
- In `StoreOrders.tsx`, after successful status update mutation, construct a WhatsApp link with a status update message and open it in a new tab (same pattern as ordering)
- Message template: "Hi {name}, your order for {product} has been updated to: {status}. — {store_name}"
- This is a manual send (opens WhatsApp) — no API key needed

---

## 4. Store Business Hours / Location

**Database changes (migration):**
- Add columns to `stores` table:
  - `business_hours jsonb DEFAULT null` — JSON object like `{"mon": "9:00-18:00", "tue": "9:00-18:00", ...}`
  - `location text DEFAULT null` — free text address
  - `is_verified boolean DEFAULT false` — admin-controlled verified badge

**Frontend changes:**
- `StoreSettings.tsx`: Add location input and business hours editor (simple text inputs per day)
- `StorefrontHome.tsx`: Display location, business hours, and verified badge in the "About" section
- `AdminStores.tsx`: Add a "Verify" toggle button

---

## 5. Product Variants (Size/Color)

**Database changes (migration):**
- New table `product_variants`:
  - `id uuid PK DEFAULT gen_random_uuid()`
  - `product_id uuid NOT NULL` (FK to products)
  - `name text NOT NULL` (e.g. "Red / Large")
  - `sku text`
  - `price numeric` (override, nullable)
  - `stock_quantity integer DEFAULT 0`
  - `is_active boolean DEFAULT true`
  - `display_order integer DEFAULT 0`
  - `created_at timestamptz DEFAULT now()`
- RLS: public SELECT on active variants, store owners full CRUD via product→store ownership check
- Enable realtime not needed

**Frontend changes:**
- `ProductForm.tsx`: Add a "Variants" section — repeatable rows with name, SKU, price override, stock
- `ProductDetail.tsx`: Show variant selector (buttons/dropdown), update displayed price and stock per selection
- `StorefrontHome.tsx`: Show "from $X" if product has variants with different prices
- WhatsApp order message includes selected variant name

---

## 6. Coupon / Discount Codes

**Database changes (migration):**
- New table `coupons`:
  - `id uuid PK DEFAULT gen_random_uuid()`
  - `store_id uuid NOT NULL`
  - `code text NOT NULL`
  - `discount_type text NOT NULL DEFAULT 'percentage'` — 'percentage' or 'fixed'
  - `discount_value numeric NOT NULL`
  - `min_order_amount numeric DEFAULT 0`
  - `max_uses integer` (nullable = unlimited)
  - `used_count integer DEFAULT 0`
  - `is_active boolean DEFAULT true`
  - `starts_at timestamptz DEFAULT now()`
  - `expires_at timestamptz` (nullable)
  - `created_at timestamptz DEFAULT now()`
  - UNIQUE constraint on `(store_id, code)`
- RLS: store owners full CRUD via `is_store_owner(store_id)`, public SELECT on active non-expired coupons for validation

**Frontend changes:**
- New `CouponsPage.tsx` under `/dashboard/stores/:storeId/coupons` — CRUD table for managing coupons
- Add "Coupons" button to store cards in `StoresList.tsx`
- `ProductDetail.tsx` / order flow: Add "Apply coupon" input field, validate against DB, show discount
- WhatsApp message includes applied coupon code and discounted total

---

## File Summary

| Action | Files |
|--------|-------|
| **New files** | `src/components/ShareStoreDialog.tsx`, `src/hooks/useMetaTags.ts`, `src/pages/CouponsPage.tsx` |
| **Modified files** | `src/pages/StoresList.tsx`, `src/layouts/StorefrontLayout.tsx`, `src/pages/StorefrontHome.tsx`, `src/pages/ProductDetail.tsx`, `src/pages/StoreSettings.tsx`, `src/pages/StoreOrders.tsx`, `src/components/ProductForm.tsx`, `src/pages/admin/AdminStores.tsx`, `src/App.tsx` |
| **DB migrations** | Add columns to `stores`, create `product_variants` table, create `coupons` table |

