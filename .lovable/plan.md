

## Plan: Move Store Management Links into the Sidebar

Since each account has one store, the store-specific pages (Products, Bulk Upload, Orders, Customers, Leads, Coupons, Settings, Domain) should be directly in the sidebar instead of being accessed through buttons on the Stores list page — like the reference image (image-20) shows.

### Approach

**`src/components/AppSidebar.tsx`** — Major restructure:
- Fetch the user's store on mount (query `stores` table for `owner_id`)
- Once the store ID is known, show store-specific nav items directly in the sidebar under a "Store" group:
  - Home (Dashboard) — `/dashboard`
  - Manage Products — `/dashboard/stores/:storeId/products`
  - Bulk Upload — `/dashboard/stores/:storeId/products/bulk-upload`
  - Customer Orders — `/dashboard/stores/:storeId/orders`
  - Customers (Leads) — `/dashboard/stores/:storeId/customers`
  - Leads — `/dashboard/stores/:storeId/leads`
  - Coupons — `/dashboard/stores/:storeId/coupons`
  - Analytics — `/dashboard/analytics`
  - Domain — `/dashboard/stores/:storeId/domain`
  - Store Settings — `/dashboard/stores/:storeId/settings`
- Show store name + logo at top of sidebar instead of generic "Store Admin"
- Keep "Settings" (user settings) and "Sign out" at bottom
- If no store exists yet, show a "Create Store" link instead of the store menu items
- Remove the standalone "Stores" nav item

**`src/pages/StoresList.tsx`** — Simplify:
- Since sidebar handles navigation, simplify this page to just show store info card with View (external link), Share, and Delete actions
- Remove all the navigation buttons (Products, Orders, Customers, etc.) since they're now in the sidebar

**`src/App.tsx`** — No route changes needed (routes already exist).

### Technical Details

- Use `useQuery` in AppSidebar to fetch the user's first store
- Use `startsWith` for `isActive` check on store sub-pages so the correct item highlights
- Store items are dynamically built using the fetched `storeId`
- Icons to match reference: `Package` (Products), `Upload` (Bulk Upload), `ShoppingBag` (Orders), `Users` (Customers), `UserCheck` (Leads), `Tag` (Coupons), `BarChart3` (Analytics), `Globe` (Domain), `Settings` (Store Settings)

