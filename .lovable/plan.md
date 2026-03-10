

## Plan: Add Return Policy, Shipping Policy Pages + Modern Footer

### Overview
Add two new storefront pages (Return Policy, Shipping Policy) with dynamic content based on store information, plus a modern footer with links, business hours, and address.

### 1. Database Migration
Add two new columns to `stores` table:
- `return_policy` (text, nullable) — custom return policy text
- `shipping_policy` (text, nullable) — custom shipping policy text

These allow store owners to customize policies. Default templates will be generated dynamically using store name/location when no custom policy is saved.

### 2. New Pages

**`src/pages/StorefrontReturnPolicy.tsx`**
- Uses `useOutletContext<StoreData>()` to get store data
- If `store.return_policy` exists, display it; otherwise show a well-structured default template using store name, city, state, WhatsApp number
- Default covers: eligibility, timeframe, condition, refund process, non-returnable items, contact info

**`src/pages/StorefrontShippingPolicy.tsx`**
- Same pattern — custom or default template
- Default covers: processing time, shipping areas (using city/state), delivery estimates, tracking, shipping costs, contact info

### 3. Modern Footer Component

**`src/components/storefront/StorefrontFooter.tsx`**
- 4-column responsive layout (stacks on mobile)
- **Column 1**: Store logo/name + description
- **Column 2**: Quick Links — Home, Contact, Return Policy, Shipping Policy
- **Column 3**: Business hours (from `store.business_hours`)
- **Column 4**: Address (location, city, state) + social links (Instagram, Facebook, WhatsApp)
- Bottom bar with copyright

### 4. Route Registration
Add routes in `App.tsx` for both subdomain and path-based storefronts:
- `return-policy` → `StorefrontReturnPolicy`
- `shipping-policy` → `StorefrontShippingPolicy`

### 5. Add Footer to Layout
Insert `<StorefrontFooter store={store} />` in `StorefrontLayout.tsx` after `<Outlet />`.

### 6. Store Settings Update
Add Return Policy and Shipping Policy textarea fields in `StoreSettings.tsx` so owners can customize the policy text.

### 7. Hamburger Menu Update
Add Return Policy and Shipping Policy links to the mobile side menu.

