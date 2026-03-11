

## Plan: Marketing, Store Management & Customer Experience Features

This is a large scope covering 3 areas. Here is the prioritized build plan, grouped into phases.

---

### Phase 1: Coupon Management UI (store owner dashboard)

The `coupons` table already exists with full schema. Need to build the dashboard UI.

- **New page**: `src/pages/StoreCoupons.tsx` — CRUD interface for store owners
  - List all coupons with status badges (active/expired/maxed out)
  - Create coupon dialog: code, discount type (% or flat), value, min order, max uses, start/expiry dates
  - Toggle active/inactive, delete
- **Route**: Add `/dashboard/stores/:storeId/coupons` to App.tsx
- **Sidebar**: Add "Coupons" link in AppSidebar.tsx

---

### Phase 2: SEO Settings Per Store

- **DB migration**: Add `meta_title`, `meta_description`, `og_image_url` columns to `stores` table
- **StoreSettings.tsx**: Add an "SEO" card section with fields for meta title, description, OG image upload
- **StorefrontLayout**: Read these fields and inject them via `useMetaTags` hook (already exists)

---

### Phase 3: Shipping & Delivery Charges

- **DB migration**: Create `store_shipping_config` table: `id`, `store_id`, `free_shipping_above` (numeric, nullable), `flat_rate` (numeric, default 0), `is_active` (bool)
- **New page**: `src/pages/StoreShipping.tsx` — simple form for flat rate shipping fee, free shipping threshold
- **Route**: Add to dashboard routes
- **CheckoutPage.tsx**: Fetch shipping config, apply charges to order total, show in summary

---

### Phase 4: Tax/GST Configuration

- **DB migration**: Create `store_tax_config` table: `id`, `store_id`, `tax_name` (text, e.g. "GST"), `tax_rate` (numeric), `is_inclusive` (bool), `is_active` (bool)
- **New page**: `src/pages/StoreTaxSettings.tsx` — configure tax name, rate, inclusive/exclusive
- **CheckoutPage.tsx**: Calculate and display tax in order summary

---

### Phase 5: Order Tracking with Status Updates

- **StorefrontAccount.tsx**: Enhance the orders tab with a visual status timeline (pending → confirmed → shipped → delivered)
- **DB migration**: Add `tracking_number`, `tracking_url` columns to `orders` table
- **StoreOrders.tsx**: Add tracking number input when updating status to "shipped"
- **Customer view**: Show tracking number/link in order details

---

### Phase 6: Invoice/Receipt PDF Generation

- Install a lightweight PDF library (e.g. use browser `window.print()` with a styled receipt component for zero-dependency approach)
- **New component**: `src/components/OrderInvoice.tsx` — formatted receipt with store logo, items, tax, shipping, total
- **StoreOrders.tsx**: Add "Download Invoice" button per order
- **CheckoutPage.tsx**: Add "Download Receipt" on order confirmation

---

### Phase 7: Abandoned Cart Recovery (basic)

- **DB migration**: Create `abandoned_carts` table: `id`, `store_id`, `customer_email`, `customer_phone`, `cart_items` (jsonb), `created_at`, `recovered` (bool)
- **CheckoutPage.tsx**: Save cart to `abandoned_carts` when user lands on checkout; mark recovered on order placement
- **Dashboard page**: `src/pages/StoreAbandonedCarts.tsx` — list abandoned carts with customer info and items

---

### Phase 8: Email/SMS Notifications (order placed)

- This requires email infrastructure. Will use Lovable Cloud's transactional email capability.
- **Edge function**: `send-order-notification` — sends order confirmation email to customer and notification to store owner
- **Trigger**: Call after successful order placement in CheckoutPage

---

### Phase 9: Bulk CSV Import Enhancement

- The existing `BulkUpload.tsx` already handles CSV import. Will enhance with:
  - Image URL column support in CSV
  - Better error display with row numbers
  - Export existing products as CSV

---

### Implementation Order (recommended)

Start with highest-impact, lowest-complexity items:
1. Coupon Management UI (DB ready, just needs frontend)
2. Shipping & Delivery setup
3. Order Tracking enhancement
4. SEO Settings
5. Tax/GST config
6. Invoice PDF
7. Abandoned cart
8. Email notifications
9. CSV enhancement

### Technical Notes

- All new tables will have RLS policies scoped to store owners
- New dashboard pages follow existing patterns (useParams for storeId, useAuth for owner verification)
- Sidebar navigation will be updated to include new sections
- All features are store-owner self-service (no developer needed)

