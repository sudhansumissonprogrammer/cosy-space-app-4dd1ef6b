

# Implementation Plan: Complete All Missing Features

Based on the audit, here is everything that needs to be built. The work is organized into 8 deliverables.

---

## 1. Database Indexes and Performance

**Migration:** Add indexes on frequently queried columns.

- `stores.slug`, `stores.owner_id`
- `products.store_id`, `products.slug`
- `whatsapp_orders.store_id`
- `customers.store_id`
- `subscriptions.user_id`

---

## 2. Dynamic Categories System

**Currently:** Categories are hardcoded in `ProductForm.tsx` as a static array.

**Changes:**
- Create a `categories` table (`id`, `store_id`, `name`, `slug`, `created_at`)
- RLS: store owners manage their own categories; public can read
- Update `ProductForm.tsx` to fetch categories from the database with an option to create new ones inline
- Update `StorefrontHome.tsx` category badges to link/filter by category

---

## 3. Storefront Search and Category Filtering

**Currently:** No search or filtering on the storefront.

**Changes:**
- Add a search input and category filter buttons to `StorefrontHome.tsx`
- Client-side filtering on product name and category (data is already fetched)

---

## 4. Password Reset Flow

**Currently:** No forgot password functionality.

**Changes:**
- Create `src/pages/ForgotPassword.tsx` with email input that calls `supabase.auth.resetPasswordForEmail()`
- Create `src/pages/ResetPassword.tsx` that handles the reset token and calls `supabase.auth.updateUser()`
- Add routes `/forgot-password` and `/reset-password`
- Add "Forgot password?" link to `Login.tsx`

---

## 5. Pagination on All List Views

**Currently:** No pagination anywhere, risking the 1000-row Supabase limit.

**Changes:**
- Add pagination to `ProductsList.tsx`, `StoreOrders.tsx`, `StoreCustomers.tsx`
- Add pagination to admin pages: `AdminUsers.tsx`, `AdminStores.tsx`, `AdminOrders.tsx`, `AdminSubscriptions.tsx`
- Use `.range(from, to)` on Supabase queries with `{ count: 'exact' }` for total counts
- Use the existing `pagination.tsx` UI component

---

## 6. Dashboard Analytics Page (Store Admin)

**Currently:** `/dashboard/analytics` shows a placeholder.

**Changes:**
- Replace `Placeholder` with a real `StoreAnalytics.tsx` page
- Show charts for: orders over time, revenue over time, top products by order count
- Query `whatsapp_orders` filtered by user's store IDs

---

## 7. Dashboard Settings Page (User Profile)

**Currently:** `/dashboard/settings` shows a placeholder.

**Changes:**
- Create `src/pages/UserSettings.tsx` with:
  - Profile update form (full name, avatar upload)
  - Password change form (`supabase.auth.updateUser()`)
  - Current plan display with usage stats

---

## 8. Security Hardening

**Database migration:**
- Add RLS policies on `orders` and `order_items` for admin read access
- Add blocked-user enforcement: create a `check_user_blocked()` function and update key RLS policies on `stores`, `products`, `whatsapp_orders` to deny access when `profiles.is_blocked = true`
- Add file size validation comments (frontend-only; enforce max 5MB on all file upload inputs)

**Frontend:**
- Add `maxLength` props to all text inputs that don't have them
- Add file size check (5MB max) before upload in `ProductForm.tsx` and `StoreSettings.tsx`
- Add `loading="lazy"` to all `<img>` tags in storefront pages

---

## Files to Create
- `src/pages/ForgotPassword.tsx`
- `src/pages/ResetPassword.tsx`
- `src/pages/StoreAnalytics.tsx`
- `src/pages/UserSettings.tsx`
- 1 database migration for indexes, categories table, admin RLS fixes, blocked-user enforcement

## Files to Edit
- `src/App.tsx` — new routes
- `src/pages/Login.tsx` — forgot password link
- `src/pages/StorefrontHome.tsx` — search + filter
- `src/pages/ProductsList.tsx` — pagination
- `src/pages/StoreOrders.tsx` — pagination
- `src/pages/StoreCustomers.tsx` — pagination
- `src/pages/admin/AdminUsers.tsx` — pagination
- `src/pages/admin/AdminStores.tsx` — pagination
- `src/pages/admin/AdminOrders.tsx` — pagination
- `src/components/ProductForm.tsx` — dynamic categories + file size validation
- `src/pages/StoreSettings.tsx` — file size validation
- `src/pages/ProductDetail.tsx` — lazy loading images
- `src/components/AppSidebar.tsx` — no changes needed (analytics/settings links already exist)

