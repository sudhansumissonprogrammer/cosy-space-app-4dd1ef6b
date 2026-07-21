# App Store — Storefront Add-ons Framework

**Built:** 2026-07-10
**Status:** v1 shipping Spin the Wheel; framework ready for more apps.

## 1-line summary
Shopify-style App Store menu inside the dashboard. Merchants install/configure/enable self-contained add-ons. First live app = Spin the Wheel (lead capture + coupon reward).

## Files added
```
src/lib/appStore/registry.ts
src/pages/appStore/AppStoreBrowse.tsx
src/pages/appStore/AppRouter.tsx
src/pages/appStore/SpinWheelConfig.tsx
src/components/storefront/apps/StorefrontApps.tsx
src/components/storefront/apps/SpinWheel/SpinWheelApp.tsx
src/components/storefront/apps/SpinWheel/Wheel.tsx
src/components/storefront/apps/SpinWheel/LeadForm.tsx
src/components/storefront/apps/SpinWheel/CouponReveal.tsx
src/components/storefront/apps/SpinWheel/types.ts
supabase/functions/store-app-lead/index.ts
.lovable/memory/features/app-store-addons.md
supabase/migrations/<timestamp>_app_store.sql   # store_apps, store_app_leads, get_store_enabled_apps RPC
```

## Files modified
- `src/components/AppSidebar.tsx` — added "Add-ons" group with App Store link (Blocks icon).
- `src/routes/AuthRoutes.tsx` — added `/dashboard/stores/:storeSlug/apps` + `/apps/:appId` routes.
- `src/layouts/StorefrontShell.tsx` — mounted `<StorefrontApps />` inside overlaysReady block.
- `.lovable/features/INDEX.md` — index entry.

## Dependencies added
None. Uses existing shadcn UI, react-query, sonner, lucide-react.

## Backend
- Tables: `public.store_apps`, `public.store_app_leads` (see migration).
- RPC: `public.get_store_enabled_apps(_store_slug text) → (app_id, config)` — anon-callable, only returns `enabled=true`.
- Edge function: `store-app-lead` (POST) — validates phone, verifies app is enabled, dedups, inserts lead with IP+UA.

## Rules
- **Widget is invisible until merchant installs + enables + saves** the app row for that store. RPC and edge function both enforce this.
- Coupon persists via `sessionStorage["pending_coupon"]` + `localStorage["pending_coupon"]` — existing checkout auto-apply hook picks it up.
- Weighted-random client-side; merchant sets odds via segment `weight`.
- Trigger uses Page Visibility API (visible-time accumulator), 11s default.

## Extraction prompt (paste in main ShopBanao chat)
```
Import feature "app-store-addons" from the attached sandbox project.

1. Copy all files listed in .lovable/features/app-store-addons.md (Files added + modified).
2. Apply the migration verbatim: create tables store_apps + store_app_leads with the RLS policies, grants, indexes, and get_store_enabled_apps RPC.
3. Deploy the store-app-lead edge function.
4. Verify:
   - Sidebar shows "App Store" under Add-ons group.
   - /dashboard/stores/:slug/apps lists 4 apps (1 live, 3 coming soon).
   - Installing + enabling + saving Spin Wheel makes the popup appear on the storefront after the trigger delay.
   - Leads captured show in the config page's leads table.
5. Do NOT remove or change any of the existing storefront overlay pattern in StorefrontShell — StorefrontApps mounts alongside them.
```

## Known gaps (v2)
- OTP verification for lead capture (stub `require_otp: false`).
- Analytics beyond leads table.
- A/B testing across configs.
- Scratch card / Countdown bar / Wishlist reminder — registry entries stubbed as `coming-soon`.