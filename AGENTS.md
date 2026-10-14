# Project architecture decisions

- WhatsApp recipient tier checks use a service-role aggregate to avoid transferring 20,000 rows per send.
- Saved addresses use `replace_customer_address` to respect the one-address unique index.
- Meesho imports use a local MV3 collector and authenticated single-product import: Meesho blocks cloud scraping; secrets never enter the extension.
- New dashboard product-photo uploads create 160w thumbnail, 800w card, 1200w PDP, and 2000w zoom variants from one original decode; the 1200w URL is canonical. Only families explicitly marked thumb160 derive tiny siblings. Resolve card siblings by the upload-path timestamp (before 2026-09-30 05:59:09 UTC: 400w; after: 800w), and fall back to canonical on unrecognized paths; single-file legacy 800w URLs never derive siblings, because every derived URL must point to a real object.
- Reserve every PayU attempt with a service-role-only row-locked database function and treat unknown attempts as unsettled, because concurrent retries must not lose a paid reference or cancel an unresolved payment.
- Open Cashfree in the current page only for Serdiya.com while retaining the modal elsewhere, because delayed modal launches are blocked by some WhatsApp/Instagram mobile browsers.

- WhatsApp onboarding provisions through the new owner's session using CreateStore steps, because setup must match the web flow and respect RLS.
- Capacity testing is admin-only and generates guarded Python runs, never browser traffic. Production permits only low-rate read-only canaries; ramp/spike/soak refuse production without override and require staging-marked hosts, protecting ads and payments.
- Keep `is_best_selling` for storefront merchandising but do not restore the separate per-product award seal, because its badge controls and stored flag were deliberately retired across all stores.

- JD Store Spy extension calls the JD platform API from the store page (content script), never the extension background, because the platform resolves the tenant from the request Origin.
- Store-specific PDP similar-design rails use a lazy store-gated component, a bounded cached public product query, and rail-local image visibility, because curated navigation must not block the main photo or fetch off-screen images.
- Imitation World uses store-gated compact gallery sizing and hides only the underneath thumbnail strip, because existing swipe, video, and zoom behavior must remain intact without changing other stores.
- Store-specific informational gallery slides use a shared presentation-only ordering helper and deferred asset URL, because category/product data must remain untouched and the opening photo must not compete with an infographic download.
- PDP cached readiness uses stable refs and passive effects, never callback-ref state updates, to prevent update loops. After main readiness, prepare a retained adjacent-slide ring at low priority so swipe downloads start before gestures.
- Shared PDP photos retry a failed exact source once, then offer explicit manual recovery; successful entries never trigger extra requests and failed downloads must not leave a silent blank gallery.
- Key PDP galleries by product and media sources, and never clear loaded-photo state when Embla initializes, because child cached-readiness effects may already have fired and will not repeat for unchanged URLs.
- Storefront cards share sticky intersection activation; category grids arm a bounded next-row buffer after opening photos decode or scrolling starts and gate eager low-priority card images through CardImageReadiness, because zero-margin/native-lazy double gating creates blank rows while opening downloads must remain bounded. Activated cards retain paint; PDP intent warmers and transition previews use the canonical 1200px photo.
- Bootstrap photo hints are route-scoped: one PDP main photo, two known category card variants, no arbitrary homepage or saved catalog photo hints; category collages activate at visibility, because early hints must match actual displayed sources.
- Existing small-display photo copies resolve through an explicit uploaded asset manifest at widths up to 320px; unknown photos and all card/PDP/zoom sources retain their existing URLs, because legacy originals must remain untouched and missing siblings must never be invented.
- Keep homepage route components and inactive theme layouts out of the shared storefront manual chunk; retain the dominant layout's critical path, because category/PDP ad entries should not parse homepage-only code.

- Public savings estimates use a dedicated calculation, separate from stored merchant billing, so marketing changes never alter charges.
- Checkout confirmation uses the completed payment method, not the prepaid preview, because COD must show no prepaid discount and the full delivery balance.

- Resolve Kalinga public contact/address through its permanent-store helper before cached shell fields; this avoids stale or duplicate details without changing authentication.
