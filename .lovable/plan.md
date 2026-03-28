

# Fix CLS (0.59) & Storefront Auth Leak

## Problem 1: CLS — Layout Shift on Product Grid

The product grid sections have no reserved height. When products load asynchronously, the grid appears and pushes content down, causing a CLS of 0.59.

**Affected files:**
- `src/pages/StorefrontHome.tsx` — Popular Products section (line 308-381) and Best Selling section
- `src/pages/StorefrontShop.tsx` — main product grid
- `src/pages/CategoryDetail.tsx` — category product grid

**Fix:** Add `min-height` and `contain: layout` to the product grid wrapper sections so they reserve vertical space before products render. Use `min-h-[calc(2*(80vw/2*1.25+120px))]` on mobile (2 rows of cards) which collapses to actual height once content loads. Simpler approach: use a fixed `min-h-[600px]` on the product section container matching the existing `LazyRender minHeight={600}` values.

Specifically:
- Wrap the Popular Products `<section>` content area in a div with `style={{ minHeight: 600, contain: "layout" }}`
- Same for Shop All and CategoryDetail grids
- The skeleton already has correct dimensions, so the skeleton → grid transition won't shift if the container reserves space

## Problem 2: `storefront_customers` Queries for Dashboard Users

**Root cause:** `StorefrontAuthProvider` wraps ALL storefront routes. When a logged-in dashboard user visits `/store/slug`, they have an auth token in localStorage, so the fast-path is skipped. `fetchOrCreateCustomer` then fires, querying/inserting into `storefront_customers` — wasteful and creates junk records.

**Fix in `src/contexts/StorefrontAuthContext.tsx`:**
- In `fetchOrCreateCustomer`, before querying, check if the user's email matches a `stores.user_id` (i.e., they're a store owner). But that adds another query.
- **Better approach:** Check the current URL path. If the user is on a dashboard route (`/dashboard`, `/products`, `/orders`, etc.), skip `fetchOrCreateCustomer`. But StorefrontAuthProvider only wraps storefront routes, so this isn't the issue.
- **Actual fix:** The real problem is that `fetchOrCreateCustomer` runs unconditionally for any authenticated user. Add a simple guard: only call `fetchOrCreateCustomer` if the user navigates to a page that actually needs customer identity (`/account`, `/checkout`, `/orders`). For browsing pages (home, shop, category, product detail), skip it entirely. This is a lazy-customer-creation pattern.

**Implementation:** Change `fetchOrCreateCustomer` to not auto-run on auth state change. Instead, expose a `ensureCustomer()` method that pages like checkout/account call explicitly. In the auth state handler, just set `session`/`user` without triggering the customer query.

## Changes

### 1. `src/pages/StorefrontHome.tsx`
- Add `style={{ minHeight: 600, contain: "layout" }}` to the Popular Products section wrapper (the `<section>` at line 263)
- Add same to the skeleton container div at line 309

### 2. `src/pages/StorefrontShop.tsx`
- Add `style={{ minHeight: 600 }}` to the main product grid container

### 3. `src/pages/CategoryDetail.tsx`
- Add `style={{ minHeight: 600 }}` to the main product grid container

### 4. `src/contexts/StorefrontAuthContext.tsx`
- Remove auto-calling `fetchOrCreateCustomer` from `onAuthStateChange` and `getSession`
- Instead, expose `ensureCustomer()` in the context that lazily fetches/creates the customer record on first call
- On auth state change, only set `session`/`user`/`loading` — no DB queries
- This eliminates the storefront_customers query for ALL browsing users (dashboard owners AND anonymous-turned-logged-in visitors just browsing)

### 5. `src/pages/StorefrontAccount.tsx` and `src/pages/CheckoutPage.tsx`
- Call `ensureCustomer()` on mount — these are the only pages that need the customer record

