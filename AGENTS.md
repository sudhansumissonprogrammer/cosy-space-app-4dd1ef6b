# Project architecture decisions

- WhatsApp recipient tier checks use a service-role aggregate to avoid transferring 20,000 rows per send.
- Saved addresses use `replace_customer_address` to respect the one-address unique index.
- Meesho imports use a local MV3 collector and authenticated single-product import: Meesho blocks cloud scraping; secrets never enter the extension.
- New dashboard product-photo uploads create 160w thumbnail, 800w card, 1200w PDP, and 2000w zoom variants from one original decode; the 1200w URL is canonical. Only families explicitly marked thumb160 derive tiny siblings. Resolve card siblings by the upload-path timestamp (before 2026-09-30 05:59:09 UTC: 400w; after: 800w), and fall back to canonical on unrecognized paths; single-file legacy 800w URLs never derive siblings, because every derived URL must point to a real object.
- Reserve every PayU attempt with a service-role-only row-locked database function and treat unknown attempts as unsettled, because concurrent retries must not lose a paid reference or cancel an unresolved payment.
- Open Cashfree in the current page only for Serdiya.com while retaining the modal elsewhere, because delayed modal launches are blocked by some WhatsApp/Instagram mobile browsers.

- WhatsApp onboarding uses the new owner session and CreateStore steps to match web setup and RLS.
- Capacity tests are admin-only guarded Python, never browser traffic. Production allows low-rate read-only canaries; ramp/spike/soak require staging hosts unless overridden, protecting ads/payments.
- Keep `is_best_selling` for storefront merchandising but do not restore the separate per-product award seal, because its controls and flag were retired.

- JD Store Spy calls the platform API from store-page content scripts, never background, because Origin identifies the tenant.
- Store-gated similar rails use lazy components, bounded cached queries and local image visibility so navigation never blocks the main photo.
- Imitation World uses store-gated compact gallery sizing and hides only the underneath thumbnail strip, because existing swipe, video, and zoom behavior must remain intact without changing other stores.
- Informational slides use shared presentation-only ordering and deferred URLs; preserve product data and opening-photo priority.
- PDP readiness uses stable refs/passive effects, not callback-ref state. Prepare retained adjacent slides at low priority after main readiness, preventing loops and blank swipes.
- PDP photos retry the exact source once, then offer manual recovery; successful photos never request again and failures never leave blank galleries.
- Key PDP galleries by product and media sources, and never clear loaded-photo state when Embla initializes, because child cached-readiness effects may already have fired and will not repeat for unchanged URLs.
- Storefront cards share sticky intersection activation; category grids arm a bounded next-row buffer after opening photos decode or scrolling starts and gate eager low-priority card images through CardImageReadiness, because zero-margin/native-lazy double gating creates blank rows while opening downloads must remain bounded. Activated cards retain paint; PDP intent warmers and transition previews use the canonical 1200px photo.
- Bootstrap photo hints are route-scoped: one PDP main photo, two known category card variants, no arbitrary homepage or saved catalog photo hints; category collages activate at visibility, because early hints must match actual displayed sources.
- Small photos up to 320px use the uploaded manifest; unknown and card/PDP/zoom URLs stay unchanged to preserve originals and avoid missing siblings.
- Keep homepage route components and inactive theme layouts out of the shared storefront manual chunk; retain the dominant layout's critical path, because category/PDP ad entries should not parse homepage-only code.

- Public savings calculations stay separate from merchant billing to avoid changing charges.
- Checkout confirmation uses the completed payment method, not the prepaid preview, because COD must show no prepaid discount and the full delivery balance.

- Resolve Kalinga public content and store-only features through its shared helper; known IDs override legacy slugs to prevent stale identity and cross-store overrides.
- Kalinga’s separate lazy carousel shares teaser cache; opt-in glass cards preserve the independent popup and animated teaser.
- Reviews use owner routes with admin fallback; errors are not empty lists.

- Validate exit coupons independently; replace only smaller discounts and hide competing sheets to prevent overlap.
- Store-gated cashback display is separate from charges to keep badges consistent.
- PDP and warmup preserve errors; retry retains the URL and negative edge results defer to fresh lookup.

- Share customer tracking URLs across dashboard and WhatsApp; Valmo has no automatic sync without a supported feed.

- Order CSV uses store-scoped pages, saved order addresses and one row per item with shared supplier links; prepare before download for mobile support.
- The PDP main photo offers the existing 800w sibling via one shared srcset/sizes, mirrored in the app, index.html and the Worker, because preload and gallery must choose the same file; only timestamped post-800w-era uploads qualify.
