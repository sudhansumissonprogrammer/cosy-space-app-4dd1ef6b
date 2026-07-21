# Sandbox Features Index

This file lists every feature/theme/component built in this remix sandbox,
so it can be extracted into the main ShopBanao project later.

Each entry links to a manifest at `.lovable/features/<slug>.md` containing:
- What was built (1-line summary)
- Full file list (added / modified)
- Dependencies added
- Backend assumptions (RPCs, edge fns, secrets)
- Copy-paste EXTRACTION PROMPT to run in main project chat

---

## Features

_(none yet — will be filled as you build)_

- [shipping-integrations](./shipping-integrations.md) — Shiprocket + direct Delhivery + direct Ekart with pickup addresses, per-order shipment creation, and label/tracking write-back (built 2026-07-10)
- [app-store-addons](./app-store-addons.md) — Extensible "App Store" dashboard menu, first app = Spin the Wheel lead-capture with animated wheel, phone form, coupon reveal (built 2026-07-10)
- [store-migration](./store-migration.md) — Migrate My Store app: import products/images from Shopify, WooCommerce, and generic sitemap-based stores (Shopdeck/Dukaan/custom) with R2 image mirroring and idempotent resumable jobs (built 2026-07-11)
- [shop-by-video](./shop-by-video.md) — Reels-style muted autoplay video carousel under Best Sellers; auto-picks any product with a video, owner controls order/title/aspect ratio/max items from dashboard (built 2026-07-11)
- [bundle-builder](./bundle-builder.md) — Pick-N-for-₹X combo builder app: merchant creates bundles with banner/price/product-pool filters; auto-menu in storefront header + shopper /bundles page with sticky selection bar (built 2026-07-12)
- [bundle-builder-v2](./bundle-builder-v2.md) — v2 upgrade: adds Fixed Combo + Frequently Bought Together bundle types on top of v1; shared pricing engine, server-side type dispatcher in place-order, backward-compatible types (built 2026-07-12)
- [fixes-2026-07-11](./fixes-2026-07-11.md) — Bug-fix pass: 6× Bundle Builder P0/P1 fixes + Pincode Checker fetch-order fix + Migrate My Store hardening (credentials wipe, stalled-job resume, source URL validation) (built 2026-07-11)

<!-- FEATURE ENTRIES BELOW — one line each, format:
- [slug](./slug.md) — one-line description (built YYYY-MM-DD)
-->

---

## How to use (in main ShopBanao project later)

1. Open main ShopBanao chat.
2. Type `@` and select this sandbox project to attach it as reference.
3. Ask: "read `.lovable/features/INDEX.md` from the attached project and list all features."
4. Pick a feature, open its manifest, copy the EXTRACTION PROMPT block, paste it in main chat.
