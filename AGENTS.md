# Project architecture decisions

- Use a service-role-only database aggregate for the WhatsApp recipient tier check, because transferring up to 20,000 message rows per send burdens the shared sender.
- Storefront saved-address writes use `replace_customer_address`, because a shopper has at most one current address and plain inserts violate its unique index.
- Meesho imports use a local Manifest V3 collector plus an authenticated one-product-at-a-time import function, because Meesho blocks cloud scraping and ShopBanao secrets must never enter the extension.
- New dashboard product-photo uploads create 800w card, 1200w PDP, and 2000w zoom WebP variants from one original decode; the 1200w URL is canonical. Resolve card siblings by the upload-path timestamp (before 2026-09-30 05:59:09 UTC: 400w; after: 800w), and fall back to canonical on unrecognized paths; single-file legacy 800w URLs never derive siblings, because card URLs must point to real objects while new retina cards stay sharp.
- Reserve every PayU attempt with a service-role-only row-locked database function and treat unknown attempts as unsettled, because concurrent retries must not lose a paid reference or cancel an unresolved payment.
- Open Cashfree in the current page only for Serdiya.com while retaining the modal elsewhere, because delayed modal launches are blocked by some WhatsApp/Instagram mobile browsers.

- The WhatsApp store-creation agent (`_shared/wa-store-onboarding.ts`, called from whatsapp-webhook) provisions stores by minting the new owner's own session and running the same steps as CreateStore, because store setup must match the web flow and respect RLS.
- Serdiya custom-site capacity tests allow only low-rate read-only canaries on production; ramp, spike, and soak profiles must refuse all production hostnames without an override, because ad traffic and payment availability must never be endangered.
- Website capacity-test configuration lives behind the existing admin role and only produces guarded Python runs; aggressive profiles require staging-marked hosts, because browsers must not become arbitrary traffic generators.
- Keep `is_best_selling` for storefront merchandising but do not restore the separate per-product award seal, because its badge controls and stored flag were deliberately retired across all stores.

- JD Store Spy extension calls the JD platform API from the store page (content script), never the extension background, because the platform resolves the tenant from the request Origin.
- Store-specific PDP similar-design rails use a lazy store-gated component, a bounded cached public product query, and rail-local image visibility, because curated navigation must not block the main photo or fetch off-screen images.
- Imitation World uses store-gated compact gallery sizing and hides only the underneath thumbnail strip, because existing swipe, video, and zoom behavior must remain intact without changing other stores.
- Storefront cards activate network-bearing children at viewport intersection; PDP intent warmers and transition previews use the canonical 1200px photo, because native lazy loading and mismatched warmers waste cold-entry bandwidth.
