---
name: app-store-addons
description: Extensible "App Store" dashboard menu for storefront add-ons. First app = Spin the Wheel (lead capture + coupon reward). Framework designed so future apps (Scratch card, Countdown bar, Wishlist reminder) plug in via a single registry.
type: feature
---

# App Store — storefront add-ons framework

## Concept
Shopify-style app catalog inside the merchant dashboard. Each app is a self-contained module (config UI + storefront widget). Merchants install → configure → enable → save. Storefront reads the enabled list via a public RPC and lazy-mounts each app's storefront component.

## Data model
- `store_apps(store_id, app_id, enabled, config jsonb)` — one row per installed app. Unique(store_id, app_id). RLS: owner-only via `stores.owner_id`.
- `store_app_leads(store_id, app_id, phone, country_code, marketing_opt_in, coupon_code, segment_label, metadata, ip, user_agent)` — captured leads. RLS: owner SELECT only. Inserts happen via the `store-app-lead` edge function with service role.
- Public RPC `get_store_enabled_apps(_store_slug text) → (app_id, config)` — anon/authenticated callable, returns only `enabled = true` rows.

## Edge function
`supabase/functions/store-app-lead/index.ts` — POST-only, validates phone (Indian mobile `[6-9]\d{9}`), checks app is enabled, dedups same phone within 60s, inserts lead with IP + UA.

## Frontend layout
```
src/lib/appStore/registry.ts                            # single source of truth (id, meta, lazy components, default config)
src/pages/appStore/AppStoreBrowse.tsx                   # /dashboard/stores/:slug/apps
src/pages/appStore/AppRouter.tsx                        # /dashboard/stores/:slug/apps/:appId → renders app.ConfigComponent
src/pages/appStore/SpinWheelConfig.tsx                  # Spin wheel config + leads table + live preview
src/components/storefront/apps/StorefrontApps.tsx       # mount point (calls RPC, lazy-renders each app's storefront component)
src/components/storefront/apps/SpinWheel/
  ├── SpinWheelApp.tsx    # widget entry (trigger, phases: wheel → lead → reveal)
  ├── wheels.tsx          # 4 wheel skins: Classic (brand palette) / Neon / Gold / Candy — WheelByStyle router
  ├── useSpinAnimation.ts # rAF-driven rotation with easeOutQuint, fires onTick per slice boundary
  ├── useWheelAudio.ts    # Web Audio API: tick() mechanical click, win() major-triad chord, lose() minor descent
  ├── Confetti.tsx        # CSS confetti burst overlay on win
  ├── LeadForm.tsx        # +91 phone input, consent checkbox, calls store-app-lead
  ├── CouponReveal.tsx    # perforated-edge ticket, copy button, persists to sessionStorage.pending_coupon
  └── types.ts            # SpinWheelConfig + WheelSegment + pickWeightedIndex
```

## Wheel design system
- `wheel_style` in config: `"classic" | "neon" | "gold" | "candy"`. Merchant picks in dashboard swatch grid.
- Classic uses the store's real `--storefront-primary` / `--storefront-accent` CSS vars so it feels branded (was hardcoded purple in preview — fixed).
- SpinWheelApp reads CSS vars at mount via `getComputedStyle(document.documentElement)`; dashboard preview injects the same vars on the wrapper to keep parity.
- `sound_enabled` toggle (default true) — Web Audio synth, no assets. Ticks fire per slice boundary via rAF, win chime on prize, confetti overlay for the celebration.
- Adding a new skin: extend `WheelStyle` union, add case in `paletteFor`, `dialogSurfaceFor`, `spinButtonStyleFor`, `confettiPaletteFor`, and export a `WheelXxx` component from `wheels.tsx`.

## Wiring points
- Sidebar: `src/components/AppSidebar.tsx` — added "Add-ons" group with App Store link (Blocks icon, menuKey `apps`).
- Routes: `src/routes/AuthRoutes.tsx` — added `stores/:storeSlug/apps` and `stores/:storeSlug/apps/:appId`.
- Storefront mount: `src/layouts/StorefrontShell.tsx` — added `<StorefrontApps />` inside overlaysReady block (gated behind `requestIdleCallback` like other overlays).

## Rules
- **Widget only shows if merchant installed + enabled + saved.** RPC returns only `enabled=true` rows; edge function rejects leads for non-enabled apps.
- Trigger uses visible-time accumulator (Page Visibility API) so background tabs don't count.
- Session dedup: `sessionStorage["sf_spin_shown_<storeId>"]`.
- Coupon persists via `sessionStorage["pending_coupon"]` + `localStorage` — existing checkout hook auto-applies it.
- Weighted random on client. Merchant controls odds via `weight` per segment.
- Reduced motion: skip spin, jump to result. Haptic vibrate on mobile.
- No OTP yet — flag `require_otp: false`, wire later using existing WhatsApp/SMS stack.

## Adding a new app
1. Add entry to `APP_REGISTRY` in `src/lib/appStore/registry.ts` with `id`, `ConfigComponent` (lazy), `StorefrontComponent` (lazy), `defaultConfig`.
2. Create config page under `src/pages/appStore/` that reads/writes `store_apps` row for that `app_id`.
3. Create storefront component under `src/components/storefront/apps/<AppName>/` accepting `{ storeId, storeName, primaryColor, config }`.
4. `AppRouter` and `StorefrontApps` pick it up automatically — no core changes.

## Live apps
- **spin-wheel** — pre-purchase gamified lead capture (timer + exit-intent). Details throughout this file.
- **scratch-card** — post-order thank-you page reveal. Self-gates to `/account/orders/:orderId`. Prize types: `coupon` (auto-provisioned into `coupons` on save), `discounted_upsell` (one-tap add-to-cart at merchant-set special price via `CartContext.addToCart`), `free_gift` (product + redeem code), `better_luck`. Per-order dedup via `localStorage["sf_scratch_${storeId}_${orderId}"]`; prize persisted per-order via `sessionStorage["sf_scratch_prize_${storeId}_${orderId}"]` so refresh doesn't reroll. Optional `once_per_customer` flag. `store-app-lead` edge fn now allows empty phone for non-lead apps (only `spin-wheel` still requires Indian mobile). Shared util `src/lib/appStore/weightedPick.ts` used by both apps. Shared `ProductPickerField` at `src/components/appStore/ProductPickerField.tsx`.

## Known gaps (future work)
- OTP verification for lead capture (stubbed).
- Analytics per app beyond leads table.
- A/B testing per app.
- Scratch card / Countdown bar / Wishlist reminder implementations (registry entries already stubbed as coming-soon).