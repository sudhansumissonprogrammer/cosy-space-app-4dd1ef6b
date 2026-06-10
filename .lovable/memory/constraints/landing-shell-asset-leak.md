---
name: landing-shell asset leak
description: shopbanao-logo asset must NOT be grouped into landing-shell — leaks landing chunk onto every storefront page
type: constraint
---
NEVER add `/src/assets/shopbanao-logo` (or any asset imported by storefront code) to the `landing-shell` manualChunks group in `vite.config.ts`.

**Why:** StorefrontFooter, CheckoutPage, V22CheckoutPage import `shopbanao-logo.webp` for the "Powered by Storivo" badge. If the logo's URL-module sits in `landing-shell`, every storefront cold load pulls the entire landing chunk (LandingApp + Index + Navbar + Hero) just to read the logo URL — measured as a ~1.5s FCP regression on cold mobile.

**Rule:** Only group app code (LandingApp, Index.tsx, landing-only components) into `landing-shell`. Assets shared across landing + storefront + dashboard must NOT be listed in manualChunks at all — let Rollup auto-place them as standalone shared modules.

**Symptom of regression:** `landing-shell-*.js` shows up in the network panel on a storefront subdomain or custom domain.
