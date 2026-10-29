# Project architecture decisions
- Subdirectories may have their own AGENTS.md; read it before changing files there.
- SEO skills stay agent-only; shell title fallbacks exclude route-owned metadata.
- Utkal Sale keeps lazy two-row brand rails, additive membership and transform-only swipe cues, because hidden items must be discoverable without scroll-jacking or extra photo loads.
- Storefront shell load errors remain distinct from confirmed missing stores and retry the same query without navigation; preserve registered tenant slugs and use custom domains in shared links, because temporary failures must not imply deleted stores or break existing integrations.
- Utkal missing watch brand memberships use the service-only title matcher and additive repair RPC before the legacy JD organizer; never overwrite existing merchant category links or infer a brand from generic titles, because imports must repair spelling aliases without changing inventory or manual merchandising.
- Inline boot recovery has one asset-error-only guard and one navigation budget carried by URL/storage/cookie; never reload on a boot timeout, and clean recovery markers on successful boot without touching shopper parameters, because slow networks and blocked storage must not create refresh loops.
- Utkal catalogue pages use identity-scoped supplier recency before merchandising; app/edge share catalogueOrder, category RPCs order before paging, and Worker mirrors it, because sorting only a loaded page cannot establish catalogue-wide order.
- Utkal buying context is a store-identity-scoped shared public content contract for app and edge rendering; only the exact legacy generated snippet campaign is bypassed, preserving separate merchant overrides and never deriving technical watch facts.
- Merchant PDP visual sections retain their existing store-scoped slot routing during content audits; address copy concerns individually rather than disabling the entire section, because blanket suppression removes unrelated merchant controls and artwork.
- Shared discovery-fact validation governs public stock and feed-required facts; both existing feed endpoints page visible tenant products and fail on query errors, because unknown inventory, guessed attributes and truncated catalogues must not be presented as verified merchant data.
- Product search metadata uses the shared neutral description/parent-price helper across app and edge renderers; Worker mirrors that contract, resolves PDP identities from the product and omits missing facts, because search/share representations must not contradict shopper data or invent commercial claims.
- Static platform JSON-LD in index.html is authoritative for the landing page; do not mount duplicate client schemas or unsupported ratings/search actions. Store and Product hooks use distinct script identities so lifecycle cleanup cannot remove another entity.
- The visible FAQ owns its matching FAQPage schema; marked platform schemas are removed before storefront app boot, and Worker utility HTML receives query-free identity with noindex/no-store at the response boundary to cover every shell exit without changing app data.
- Rounded Classic navigation reuses the Classic component through a presentation-only flag, preserving icons, cart actions, route visibility and scroll behavior without duplicated navigation logic.
- Static platform robots and generated storefront robots use the shared crawler policy; AI crawler rendering must agree with those permissions, while authentication and utility noindex remain independent.
- Public search/AI GET and HEAD requests dispatch to tenant SEO rendering before human HTML caches and cold/streaming shell exits; AI budgets remain host-scoped and bounded because user-agent names are not authentication.
- Storefront Markdown is negotiated from the same successful public HTML renderer with a pinned converter; Worker caches separate format and page identity and vary by Accept, preventing cross-format leaks without changing browser or private pages.
- Every storefront route owns its primary heading; home themes use the shared store-heading builder independently of optional banners and carousel slides, preventing missing or changing page identity in existing and future stores.
- Public SEO discovery uses bounded, addressable catalogue pages and error-preserving paged sitemap queries; renderer/cache page identity and shopper pagination must agree without changing checkout pricing.
- Existing dynamic storefront sitemaps split into indexed deterministic children at conservative URL/UTF-8 byte bounds; unknown children fail without caching and feeds omit condition unless merchant-sourced.
- Store shell metadata only owns home; route metadata owns detail pages, and manufacturer identifiers are never derived from seller names or internal IDs, preventing canonical races and false product claims.
- Catalogue routes share strict page parsing and sequential links; failed category membership queries never fall back to an unfiltered catalogue, preventing hidden or unrelated product leakage.
- Anonymous direct product reads rely on the existing public visibility RLS instead of querying ungranted internal columns; never broaden product SELECT grants to repair a storefront filter.
- Product category metadata resolves independently of photo readiness; use real public category slugs or a truthful Shop All fallback, never guessed slugs.
- The storefront shell owns utility-page noindex metadata across themes, with query-free generic canonicals so private order/search parameters never become search identity.

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
- All PDP themes pass category/slug eligibility to shared informational-slide ordering; defer URLs and preserve product data and main-photo priority.
- PDP galleries: stable refs/passive readiness; key by product+media and never clear loaded state on Embla init; prepare adjacent slides at low priority after main readiness; retry an exact source once then offer manual recovery, because cached-readiness effects don't repeat and blank/looping galleries must not occur.
- All storefront product-card themes share sticky mobile activation with one upcoming two-card buffer after visible opening photos settle or scrolling starts; a shared observer and frame-coalesced scheduler gate eager low-priority photos without per-card polling, because visibility-only/native-lazy double gating leaves blank rows. Desktop and PDP gallery scheduling stay separate; activated photos retain paint and PDP intent warmers keep canonical sources.
- Bootstrap photo hints are route-scoped: one PDP main photo, two known category card variants, no arbitrary homepage or saved catalog photo hints; category collages activate at visibility, because early hints must match actual displayed sources.
- Small photos up to 320px use the uploaded manifest; unknown and card/PDP/zoom URLs stay unchanged to preserve originals and avoid missing siblings.
- Keep homepage route components and inactive theme layouts out of the shared storefront manual chunk; retain the dominant layout's critical path, because category/PDP ad entries should not parse homepage-only code.

- Savings stay separate from billing; confirmations use completed payment methods. Shared app/edge persisted-ID policy allows Utkal optional advance plus full COD; other stores retain required advances.

- Resolve Kalinga public content and store-only features through its shared helper; known IDs override legacy slugs to prevent stale identity and cross-store overrides.
- Kalinga’s separate lazy carousel shares teaser cache; opt-in glass cards preserve the independent popup and animated teaser.
- Reviews use owner routes with admin fallback; errors are not empty lists.

- Validate exit coupons independently; replace only smaller discounts and hide competing sheets to prevent overlap.
- Store-gated cashback display is separate from charges to keep badges consistent.
- PDP and warmup preserve errors; retry retains the URL and negative edge results defer to fresh lookup.

- Share customer tracking URLs across dashboard and WhatsApp; Valmo has no automatic sync without a supported feed.

- Order CSV uses store-scoped pages, saved order addresses and one row per item with shared supplier links; prepare before download for mobile support.

- Mirror PDP photo srcset/sizes in app, index.html and Worker (post-800w-era only); the Worker preview hands off on sf:pdp-hero-painted after briefly holding code, so the photo paints first.- Google Ads tracking: per-store `features.google_ads_id` / `google_ads_purchase_label` / `gtm_container_id` (set in dashboard Tracking page); `trackGoogleAds.ts` reuses the GA4 gtag.js file and fires purchase once per order with transaction_id dedup; no enhanced conversions until a recorded advertising-consent flow exists.
- City/store-directory pages (`/stores`, `/stores/:city`) read `public.store_locations` (published rows only) and build all wording through `supabase/functions/_shared/storeLocations.ts`, shared by the app and bot-render, because human and crawler output must never diverge and only merchant-verified facts may appear; delivery-only cities must never be presented as physical branches or carry Store schema.
- Utkal brand-category headings, intros, FAQs and related links come from one shared helper (_shared/utkalCategorySeo.ts) used by the app and bot-render, built only from category names and listed product titles, because crawler and shopper pages must match and must not invent facts.
- StorefrontShell's language selector portals to document.body as a fixed lower-left control outside page layout and right-hand overlays, preserving header/main sibling rules and PDP geometry; the non-English-only translator applies common controls/local cache immediately and uses bounded, visible-first requests with in-flight deduplication and language-generation cancellation, preserving product names and digits without delaying English page load.
