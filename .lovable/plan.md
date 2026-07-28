## Goal

Three connected changes across every storefront theme, built so cold home / category / PDP load speed is unchanged:

1. Universal "smart" header + mobile bottom nav (hide on scroll down, reveal on scroll up).
2. WhatsApp moves from the floating bubble into the header (replacing the account icon — account already lives in the bottom nav as "Orders").
3. A new floating **Trust Video** button in the old WhatsApp spot that opens a reel-style, video-only player with a glassmorphic "See more details" CTA, powered by owner-uploaded videos and chained into the existing Shop by Video app.

---

## 1. Universal smart header + smart bottom nav

Today `useSmartHeader()` is only wired into `CheckoutAwareLayout` (mobile header) and `DesktopNavBar`. Themes with their own headers (`MobileAppHeader` used by V3/V11, the V13 inline header, and the other V10–V22 layouts) never hide on scroll, and no bottom nav hides at all.

- Extend `useSmartHeader` into a shared `useSmartChrome()` returning `{ headerVisible, navVisible }`, driven by one rAF-throttled scroll listener (single listener, no per-component cost).
- Apply the existing `smart-header` / `smart-header-hidden` CSS classes to every theme header: `MobileAppHeader`, `StorefrontLayoutV13`'s inline header, and any other layout that renders its own `<header>`.
- Add matching `smart-nav` / `smart-nav-hidden` transform classes to `MobileBottomNavSwitcher` so all 11 nav variants inherit the behaviour from one wrapper (no edits inside each variant).
- Always-visible rules: near page top (<80px), when the cart drawer/sheet/search overlay is open, and on checkout routes.
- New universal toggle in Theme Settings → "Auto-hide header & nav on scroll" (default on), stored on `store_theme_config`. One switch controls both, all themes.

## 2. WhatsApp in the header

- `CheckoutAwareLayout`'s `ActionButtons` currently renders `AccountBadge`. Replace it with a `HeaderWhatsAppButton` (only when `store.whatsapp_number` is set; falls back to the account icon if not).
- Same swap for `DesktopNavBar` and `MobileAppHeader`.
- Remove the floating `FloatingWhatsApp` mount from `StorefrontShell`.

## 3. Floating Trust Video reel

**Data (new, small migration)**

`store_trust_videos`: `id, store_id, video_url, poster_url, title, cta_label, cta_target (category/product/url), sort_order, is_active, created_at` + GRANTs (`anon` SELECT for active rows, owner full via RLS) and RLS policies scoped to the store owner.

**Dashboard — Theme Settings → "Trust Videos"**

- Upload many videos; each row gets a title, CTA label, and a CTA target picker (any category, product, or custom path).
- Reuses the existing `uploadCompressedVideo` pipeline (WebCodecs H.264, 1080p cap, ~3.5 Mbps, poster frame auto-generated) → R2 CDN. Compression only downsizes when it actually saves bytes, so quality is preserved.
- Drag-reorder, toggle active, delete.

**Storefront — zero cold-load cost**

- The floating button is a tiny static pill (glass, no JS video). It renders only if the store has ≥1 active trust video — that flag rides along in the existing storefront shell payload, so no extra request on cold load.
- Nothing video-related is fetched or parsed until the button is tapped: the player component, the video list query, and the media itself are all `lazy()` / on-demand. `preload="none"` until the sheet opens.
- Player: full-screen reel, vertical swipe between videos, autoplay muted with tap-to-unmute, no chrome, no titles floating around — just the video plus a glassmorphic bottom CTA ("See more details") that navigates to the owner's chosen target.
- After the owner's trust videos finish, if the **Shop by Video** app is enabled for the store, the reel continues into product videos (same `products.video_url` source the carousel uses), with "See more details" going to that product's PDP. If the app is off, the reel just ends.
- Applies to all themes because it mounts once in `StorefrontShell`, same place the WhatsApp bubble was.

## UI direction

Frosted glass throughout: translucent blurred pills for the floating button and CTA, thin light borders, soft shadows, spring-ish scale on tap, respecting each theme's `--storefront-*` colour variables so it never clashes.

## Technical notes

- No new dependencies.
- One scroll listener shared by header + nav; transforms only (no layout thrash).
- Trust-video bundle is a separate lazy chunk, not referenced from any home/category/PDP critical path.
- Migration includes GRANTs + RLS in the same statement block.
- Rollout: `serdiyajewellers` first (owner uploads its videos), but the feature is available to every store from the dashboard.
