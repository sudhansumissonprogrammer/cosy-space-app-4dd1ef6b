

## Plan: Order Search/Filters, Customer Detail Page, Product Image Preview & Long-Press Select

### 1. StoreOrders.tsx — Add Search & Filters

Add a search/filter bar above the orders table (matching the ProductsList pattern):

- **Search input**: Filter by customer name or order ID (first 8 chars)
- **Status filter pills**: Inline buttons for pending, confirmed, shipped, delivered, cancelled (toggle on/off)
- **Date filter**: Date range picker using Popover + Calendar component (from/to)
- **Client-side filtering**: Apply search + status + date filters on the fetched orders using `useMemo`, same pattern as ProductsList
- Active filter chips with clear-all button

### 2. StoreCustomers.tsx — Customer Detail Sheet

Make each customer row clickable to open a detail Sheet (bottom drawer on mobile):

- **Customer profile header**: Name, phone, email, joined date
- **Stats row**: Total orders, total spent (calculated from their orders)
- **Order history list**: Query `orders` + `whatsapp_orders` tables filtered by customer phone/email, show recent orders with status badges
- **Address info**: Display from `customers.address` jsonb field if available
- No new DB tables needed — join on `orders.customer_phone = customer.phone` or match by email

### 3. ProductsList.tsx — Product Image Preview on Tap

- Add a Dialog/modal state for image preview
- On product image thumbnail click (in mobile card view), prevent navigation and open a fullscreen image dialog with the product image displayed large
- On desktop table view, same behavior on image cell click

### 4. ProductsList.tsx — Long-Press to Enter Bulk Select

- Add `onTouchStart`/`onTouchEnd` handlers on mobile product rows
- After 600ms hold, enter bulk mode and auto-select that product
- Use a `useRef` timer pattern to detect long-press
- Cancel on `onTouchMove` to avoid accidental triggers during scroll
- Visual feedback: subtle scale animation during press

### Technical Details

**Files to modify:**
- `src/pages/StoreOrders.tsx` — Add search input, status pills, date range popover, `useMemo` filtering
- `src/pages/StoreCustomers.tsx` — Add click handler on rows, Sheet component with customer detail view, secondary query for customer orders
- `src/pages/ProductsList.tsx` — Add image preview Dialog, long-press handlers with timer refs

**No database changes needed.** All filtering is client-side on already-fetched paginated data. Customer orders lookup uses existing RLS-protected queries.

