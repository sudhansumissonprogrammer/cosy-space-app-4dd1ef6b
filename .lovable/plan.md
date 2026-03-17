

## Plan: Enhanced PWA + Push Notifications + Admin Notification Center

This is a large feature set. Here's what's already in place and what needs to be built.

### What Already Works
- `DynamicPwaManifest` already injects per-store PWA manifests on storefronts (store name + logo)
- Admin dashboard already uses `DynamicPwaManifest` with Storivo branding
- `OrderNotificationListener` already shows in-app toasts + browser `Notification` API for new orders
- `PwaInstallBanner` and `SmartInstallPrompt` handle install prompts

### What Needs to Be Built

#### 1. PWA App Badge for Unseen Orders (Admin)
**File: `src/components/OrderNotificationListener.tsx`**
- After each new order notification, call `navigator.setAppBadge(count)` (Badging API) to show unseen order count on the PWA icon
- Track unseen count: fetch pending orders count, increment on new order via realtime, clear when admin visits orders page
- Add `navigator.clearAppBadge()` call when orders page is opened

**File: `src/layouts/DashboardLayout.tsx`**
- Clear app badge when user navigates to orders page

#### 2. Store Notifications Table + Admin UI to Send Notifications
**Database migration** -- new table `store_notifications`:
- `id`, `store_id`, `title`, `body`, `link_url` (optional -- deep link on click), `created_at`
- RLS: store owners can CRUD their own, public can read (for storefront)

**File: `src/pages/StoreNotifications.tsx`** (new page)
- Simple form: Title, Message body, optional link URL
- "Send Notification" button that inserts into `store_notifications`
- List of previously sent notifications
- Add route in `App.tsx` under dashboard

**File: `src/layouts/DashboardLayout.tsx`**
- Add "Notifications" menu item (Bell icon) linking to the new page

#### 3. Customer Storefront Notification Listener
**File: `src/components/storefront/StorefrontPushListener.tsx`** (new)
- Subscribe to realtime `INSERT` on `store_notifications` filtered by `store_id`
- On new notification: show browser `Notification` with title + body
- On click, open the `link_url` or just focus the PWA window
- Play a chime sound

**File: `src/layouts/StorefrontLayout.tsx`** (and all layout variants)
- Add `<StorefrontPushListener storeId={store.id} />` alongside existing `StorefrontOrderNotification`

#### 4. Ensure All Storefronts Have Custom PWA
- Already done via `DynamicPwaManifest` in every layout. Verified all layouts (V1-V13) include it with `store.name` and `store.logo_url`.

### Summary of Changes

| Action | File |
|--------|------|
| Migration | Create `store_notifications` table with RLS |
| Create | `src/pages/StoreNotifications.tsx` (admin send notification UI) |
| Create | `src/components/storefront/StorefrontPushListener.tsx` (customer realtime listener) |
| Edit | `src/components/OrderNotificationListener.tsx` (add app badge API) |
| Edit | `src/layouts/DashboardLayout.tsx` (clear badge + add menu item) |
| Edit | `src/App.tsx` (add route for notifications page) |
| Edit | All storefront layouts (add `StorefrontPushListener`) |

### Technical Notes
- **Push notifications** use the browser `Notification` API (already requested permission in existing code). This works when the PWA is open/in background. True push (when app is closed) requires a push server + service worker which is a much larger scope -- the current approach matches what's feasible in a PWA without a push subscription server.
- **App Badge API** (`navigator.setAppBadge`) is supported in Chrome/Edge PWAs on Android and desktop. iOS Safari does not support it yet.
- The `store_notifications` table needs realtime enabled via `ALTER PUBLICATION supabase_realtime ADD TABLE public.store_notifications`.

