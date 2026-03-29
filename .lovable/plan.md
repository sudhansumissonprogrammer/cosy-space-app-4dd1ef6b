

## Plan: Store Pages Manager

### What we're building
A new "Pages" section in the dashboard where store owners can manage all their storefront pages (About Us, Contact Us, Return Policy, Shipping Policy, Privacy Policy, Terms & Conditions) from one place. They can edit content, add custom pages, and delete pages. The About Us and Policy sections will be **removed from Store Settings** and moved here.

### Database changes

**New table: `store_pages`**
- `id` (uuid, PK)
- `store_id` (uuid, not null)
- `page_type` (text) — e.g. `about_us`, `contact`, `return_policy`, `shipping_policy`, `privacy_policy`, `terms`, `custom`
- `title` (text, not null)
- `content` (text) — rich text / plain text content
- `image_url` (text, nullable) — optional page image
- `slug` (text) — for custom pages URL
- `is_active` (boolean, default true)
- `display_order` (integer, default 0)
- `created_at`, `updated_at`
- Unique constraint on `(store_id, page_type)` for system pages, allowing multiple `custom` types
- RLS: store owners can CRUD, public can read active pages

### New files

1. **`src/pages/StorePages.tsx`** — Main pages list view
   - Shows all pages as cards (About Us, Contact, Return Policy, Shipping Policy, Privacy, Terms)
   - Each card shows title, status (active/inactive toggle), and Edit/Delete buttons
   - "Add New Page" button at the top for custom pages
   - System pages (about_us, return_policy, etc.) cannot be deleted, only edited
   - On first load, auto-seeds default system pages from existing store data (`about_us_text`, `return_policy`, `shipping_policy`)

2. **`src/pages/StorePageEditor.tsx`** — Page editor (edit/create)
   - Title input
   - Content textarea (with rich formatting placeholder)
   - Optional image upload (reuse existing image upload pattern)
   - Active/Inactive toggle
   - Save button updates `store_pages` table
   - For `about_us` type, also syncs back to `stores.about_us_text` and `stores.about_us_image_url` for backward compatibility with storefront

### Modified files

3. **`src/routes/AuthRoutes.tsx`** — Add two new routes:
   - `stores/:storeSlug/pages` → `StorePages`
   - `stores/:storeSlug/pages/:pageId/edit` → `StorePageEditor`
   - `stores/:storeSlug/pages/new` → `StorePageEditor` (create mode)

4. **`src/components/AppSidebar.tsx`** — Add "Pages" item to the settings group with `FileText` icon

5. **`src/layouts/DashboardLayout.tsx`** — Add "Pages" to mobile menu under Store section

6. **`src/pages/StoreSettings.tsx`** — Remove the "About Us Page" card (section 5) and "Store Policies" card (section 6), replace with a link card pointing to the new Pages section

### How it works
- Store owner navigates to Pages from sidebar
- Sees a list of all page cards with edit buttons
- Clicks edit to open an editor with title, content textarea, and image upload
- System pages (About Us, Return Policy, etc.) are pre-created and cannot be deleted
- Custom pages can be added and deleted
- Content saves to `store_pages` table; About Us and policies also sync to the `stores` table columns for storefront backward compatibility

### Navigation addition
- Sidebar: "Pages" under Store group (between "Theme" and "Domain")
- Mobile menu: "Pages" in Store section
- Menu key: `pages` (for admin menu config visibility)

