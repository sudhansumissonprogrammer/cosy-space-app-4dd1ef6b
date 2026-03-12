

## Super Admin Comprehensive Fix Plan

### Understanding the Request
You want to **merge Users and Stores into a single unified page** instead of separate menus. The combined view should show all stores with their owner details, plus users who signed up but never created a store.

---

### Step 1: Database Fixes

**A. Attach missing trigger** (migration):
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**B. Backfill 6 missing profiles and subscriptions** (data insert):
- Insert missing profiles from `auth.users` where no profile exists
- Insert free-plan subscriptions for those users

---

### Step 2: Create `get_admin_users_stores` RPC

A single `SECURITY DEFINER` function that returns all users with their store info (if any):

- Joins `auth.users` (email, created_at) with `profiles` (full_name, is_blocked)
- Left-joins `stores` (name, slug, is_suspended, is_verified, logo_url, created_at)
- Adds product count and order count per store
- Guarded by `has_role(auth.uid(), 'admin')`
- Returns: user_id, email, full_name, is_blocked, user_created_at, store_id, store_name, store_slug, store_logo, is_suspended, is_verified, product_count, order_count

---

### Step 3: Merge into Single "Users & Stores" Page

**Remove**: Separate `AdminUsers` and `AdminStores` pages and routes.

**Create**: New `AdminUsersStores.tsx` page at `/admin/users-stores` with:

- Search bar (filter by email, name, or store name)
- Table columns: User (email + name) | Store (name + logo, or "No store") | Products | Orders | Status (Active/Blocked/Suspended) | Verified badge | Joined date | Actions
- Actions: Block/Unblock user, Suspend/Activate store, Verify/Unverify store, Delete
- Users without stores show "No store created" in the Store column
- Pagination

---

### Step 4: Fix AdminStores Column Bug

The current table has headers: Store | Slug | Owner ID | Status | **Verified** | **Created** | Actions
But data renders Created under Verified and Verified under Created. This gets fixed automatically since we're rebuilding the page.

---

### Step 5: Enhance AdminOverview

Update `get_admin_stats` RPC to also return:
- Last 5 signups (email + date)
- Last 5 orders (store name + total + date)

Add a "Recent Activity" section below the stat cards.

---

### Step 6: Add Platform Settings Page

New `/admin/settings` route with:
- Platform name configuration
- Default currency setting
- Stored in a new `platform_config` table (single-row config pattern)

---

### Step 7: Update Sidebar Navigation

Update `AdminLayout.tsx` nav items:
- Overview → `/admin`
- Users & Stores → `/admin/users-stores` (merged, replaces both Users and Stores)
- Orders → `/admin/orders`
- Subscriptions → `/admin/subscriptions`
- Analytics → `/admin/analytics`
- Settings → `/admin/settings` (new)

---

### Files to Create/Edit

| File | Action |
|------|--------|
| Migration (trigger + backfill) | Create |
| Migration (get_admin_users_stores RPC) | Create |
| Migration (enhanced get_admin_stats) | Create |
| Migration (platform_config table) | Create |
| `src/pages/admin/AdminUsersStores.tsx` | Create (merged page) |
| `src/pages/admin/AdminSettings.tsx` | Create |
| `src/layouts/AdminLayout.tsx` | Edit (update nav) |
| `src/routes/AuthRoutes.tsx` | Edit (update routes) |
| `src/pages/admin/AdminOverview.tsx` | Edit (add recent activity) |
| `src/pages/admin/AdminUsers.tsx` | Delete |
| `src/pages/admin/AdminStores.tsx` | Delete |

