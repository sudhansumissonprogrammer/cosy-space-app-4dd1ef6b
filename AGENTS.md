# Project architecture decisions
- Subdirectories may have their own AGENTS.md; read it before changing files there.
- SEO skills are agent-only; shell titles exclude route metadata.
- Utkal Sale keeps lazy two-row rails, additive membership and transform-only swipe cues; its category-only banner reserves intrinsic dimensions and retains an accessible heading without visible intro spacing.
- Storefront shell load errors remain distinct from confirmed missing stores and retry the same query without navigation; preserve registered tenant slugs and use custom domains in shared links, because temporary failures must not imply deleted stores or break existing integrations.
- Utkal missing watch brand memberships use the service-only title matcher and additive repair RPC before the legacy JD organizer; never overwrite existing merchant category links or infer a brand from generic titles, because imports must repair spelling aliases without changing inventory or manual merchandising.
- Inline boot recovery has one asset-error-only guard and one navigation budget carried by URL/storage/cookie; never reload on a boot timeout, and clean recovery markers on successful boot without touching shopper parameters, because slow networks and blocked storage must not create refresh loops.
- Utkal catalogue pages use identity-scoped supplier recency before merchandising; app/edge share catalogueOrder, category RPCs order before paging, and Worker mirrors it, because sorting only a loaded page cannot establish catalogue-wide order.
- Utkal buying context is a store-identity-scoped shared public content contract for app and edge rendering; only the exact legacy generated snippet campaign is bypassed, preserving separate merchant overrides and never deriving technical watch facts.
- Preserve merchant PDP slots during audits; fix copy only. Utkal assurances use the quality grid/compact strip, not a duplicate COD strip; generic stores and checkout stay unchanged.
- Shared discovery-fact validation governs public stock and feed-required facts; both existing feed endpoints page visible tenant products and fail on query errors, because unknown inventory, guessed attributes and truncated catalogues must not be presented as verified merchant data.
- Product search metadata uses the shared neutral description/parent-price helper across app and edge renderers; Worker mirrors that contract, resolves PDP identities from the product and omits missing facts, because search/share representations must not contradict shopper data or invent commercial claims.
- Static platform JSON-LD in index.html is authoritative for the landing page; do not mount duplicate client schemas or unsupported ratings/search actions. Store and Product hooks use distinct script identities so lifecycle cleanup cannot remove another entity.
- The visible FAQ owns its matching FAQPage schema; marked platform schemas are removed before storefront app boot, and Worker utility HTML receives query-free identity with noindex/no-store at the response boundary to cover every shell exit without changing app data.
- Rounded Classic reuses Classic via a flag.
- Static platform robots and generated storefront robots use the shared crawler policy; AI crawler rendering must agree with those permissions, while authentication and utility noindex remain independent.
- Public search/AI GET and HEAD requests dispatch to tenant SEO rendering before human HTML caches and cold/streaming shell exits; AI budgets remain host-scoped and bounded because user-agent names are not authentication.
- Storefront Markdown is negotiated from the same successful public HTML renderer with a pinned converter; Worker caches separate format and page identity and vary by Accept, preventing cross-format leaks without changing browser or private pages.
- Every storefront route owns its primary heading; home themes use the shared store-heading builder independently of optional banners and carousel slides, preventing missing or changing page identity in existing and future stores.
- Public SEO discovery uses bounded, addressable catalogue pages and error-preserving paged sitemap queries; renderer/cache page identity and shopper pagination must agree without changing checkout pricing.
- Existing dynamic storefront sitemaps split into indexed deterministic children at conservative URL/UTF-8 byte bounds; unknown children fail without caching and feeds omit condition unless merchant-sourced.
- Shell metadata owns home, routes own detail pages; never derive manufacturer IDs from sellers/internal IDs, preventing canonical races and false claims.
- Catalogue routes share strict page parsing and sequential links; failed category membership queries never fall back to an unfiltered catalogue, preventing hidden or unrelated product leakage.
- Anonymous direct product reads rely on the existing public visibility RLS instead of querying ungranted internal columns; never broaden product SELECT grants to repair a storefront filter.
- Product category metadata resolves independently of photo readiness; use real public category slugs or a truthful Shop All fallback, never guessed slugs.
- The storefront shell owns utility-page noindex metadata across themes, with query-free generic canonicals so private order/search parameters never become search identity.

- WhatsApp tiers use service-role aggregates.
- Saved addresses use `replace_customer_address`.
- Meesho uses local MV3 collection and authenticated single-product imports; cloud scraping is blocked, extension has no secrets.
- New dashboard product-photo uploads create 160w thumbnail, 800w card, 1200w PDP, and 2000w zoom variants from one original decode; the 1200w URL is canonical. Only families explicitly marked thumb160 derive tiny siblings. Resolve card siblings by the upload-path timestamp (before 2026-09-30 05:59:09 UTC: 400w; after: 800w), and fall back to canonical on unrecognized paths; single-file legacy 800w URLs never derive siblings, because every derived URL must point to a real object.
- Reserve every PayU attempt with a service-role-only row-locked database function and treat unknown attempts as unsettled, because concurrent retries must not lose a paid reference or cancel an unresolved payment.
- Open Cashfree in the current page only for Serdiya.com while retaining the modal elsewhere, because delayed modal launches are blocked by some WhatsApp/Instagram mobile browsers.

- WhatsApp onboarding uses the new owner session and CreateStore steps to match web setup and RLS.
- Capacity tests are admin-only guarded Python, never browser traffic. Production allows low-rate read-only canaries; ramp/spike/soak require staging hosts unless overridden, protecting ads/payments.
- Keep is_best_selling; never restore the retired award seal.
- storefrontBranding gates platform copy by Utkal/Kalinga identity across cart, footer and checkout; payments stay unchanged.

- JD Store Spy calls the platform API from store-page content scripts, never background, because Origin identifies the tenant.
- Similar rails use store gates, lazy components and bounded visible queries, never blocking the main photo.
- Imitation World alone uses compact galleries without thumbnails; Utkal alone fits each photo's measured aspect ratio, retaining legacy video sizing/player. Preserve swipe, zoom and other stores.
- All PDP themes pass category/slug eligibility to shared informational-slide ordering; defer URLs and preserve product data and main-photo priority.
- PDP galleries: stable refs/passive readiness; key by product+media and never clear loaded state on Embla init; prepare adjacent slides at low priority after main readiness; retry an exact source once then offer manual recovery, because cached-readiness effects don't repeat and blank/looping galleries must not occur.
- All storefront product-card themes share sticky mobile activation with one upcoming two-card buffer after visible opening photos settle or scrolling starts; a shared observer and frame-coalesced scheduler gate eager low-priority photos without per-card polling, because visibility-only/native-lazy double gating leaves blank rows. Desktop and PDP gallery scheduling stay separate; activated photos retain paint and PDP intent warmers keep canonical sources.
- Bootstrap photo hints are route-scoped: one PDP main photo, two known category card variants, no arbitrary homepage or saved catalog photo hints; category collages activate at visibility, because early hints must match actual displayed sources.
- Small photos up to 320px use the uploaded manifest; unknown and card/PDP/zoom URLs stay unchanged to preserve originals and avoid missing siblings.
- Keep homepage route components and inactive theme layouts out of the shared storefront manual chunk; retain the dominant layout's critical path, because category/PDP ad entries should not parse homepage-only code.

- Confirmations use completed payment methods. Utkal checkout gates full prepaid by store identity while retaining gateways for advances and standalone COD; others retain configured choices. place-order recomputes utkalPartialDiscount; checkoutPartialAmounts caps savings to the delivery balance so net payable equals advance plus balance without changing gross totals.

- Resolve Kalinga public content and store-only features through its shared helper; known IDs override legacy slugs to prevent stale identity and cross-store overrides.
- Kalinga's lazy carousel shares teaser cache; glass cards keep the separate popup/teaser.
- Reviews retain owner/admin routes, errors and store-scoped photos without invented ratings. Gallery taps force lazy mounting with retained open intent; community banners mount only for eligible mobile sticky actions.

- Validate exit coupons independently; replace only smaller discounts and hide competing sheets to prevent overlap.
- Store-gated cashback display is separate from charges to keep badges consistent.
- PDP and warmup preserve errors; retry retains the URL and negative edge results defer to fresh lookup.

- Dashboard/WhatsApp share tracking URLs; Valmo needs a feed.

- Order CSV uses store-scoped pages, saved order addresses and one row per item with shared supplier links; prepare before download for mobile support.

- Mirror PDP photo srcset/sizes in app, index.html and Worker (post-800w-era only); the Worker preview hands off on sf:pdp-hero-painted after briefly holding code, so the photo paints first.- Google Ads tracking: per-store `features.google_ads_id` / `google_ads_purchase_label` / `gtm_container_id` (set in dashboard Tracking page); `trackGoogleAds.ts` reuses the GA4 gtag.js file and fires purchase once per order with transaction_id dedup; no enhanced conversions until a recorded advertising-consent flow exists.
- City/store-directory pages (`/stores`, `/stores/:city`) read `public.store_locations` (published rows only) and build all wording through `supabase/functions/_shared/storeLocations.ts`, shared by the app and bot-render, because human and crawler output must never diverge and only merchant-verified facts may appear; delivery-only cities must never be presented as physical branches or carry Store schema.
- Utkal brand-category headings, intros, FAQs and related links come from one shared helper (_shared/utkalCategorySeo.ts) used by the app and bot-render, built only from category names and listed product titles, because crawler and shopper pages must match and must not invent facts.
- Language controls portal lower-left outside layout/overlays; non-English translation uses immediate cached controls, bounded visible-first requests, deduplication and generation cancellation, preserving names/digits and English loading.
- Utkal's third box uses the latest active matching category setting, independent of product titles/entry URLs; checkout validates its ID and saved price, and orders retain a name/price snapshot.
- Utkal bulk is owner-gated; replied inbox filters before paging, latest incoming first.
- Analytics uses owner/admin aggregates and lazy Three.js/Natural Earth views; unknown geography stays unplotted. Raw/archive traffic selects once per local day; cleanup_app_logs never rewrites it. Daily archives are not whole-range unique visitors.
