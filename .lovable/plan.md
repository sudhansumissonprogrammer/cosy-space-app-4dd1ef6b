# Cold-entry photo loading: category, product page and homepage

## What this fixes

Category cards should download their **800px card photo**, not download a second **1200px product-page photo** before the shopper opens that product. A direct product-page visit should start with **one 1200px main photo**, with other gallery photos waiting for a swipe and **2000px reserved for zoom**.

Keep existing sharp photos, sale badges, store branding, Similar designs, shopping and advertising measurement intact. Apply shared loading corrections across storefronts; keep Imitation World’s compact gallery, hidden gallery thumbnails and curated Similar designs strip exclusive to that store.

## Verified findings

These counts are from the saved fresh-browser Imitation World tests, approximately 40 seconds without scrolling—not every product or every device.

| Tested entry | Product/category photo files downloaded | What happened |
|---|---:|---|
| Chain with Pendant category | 17 | Six 1200px product photos, eight 800px card photos, and three category-navigation photos. Six products downloaded in both sizes. |
| Tested pendant product page | 8 | One 1200px main photo, the same product’s 800px photo, and six other products’ 800px photos for Similar designs. |

The product page also downloaded logos, sale/payment/trust graphics: **19 distinct image URLs overall**, versus eight product-photo URLs. **No 2000px photo was observed before zoom.** Therefore, the evidence does **not** say all three sizes download at opening. It says 800px and 1200px duplicated the main photo, while the supposedly small similar photos were actually 800px files.

### Why this happens

- The early category photo loader uses the stored original URL, which is normally the 1200px URL. The card later resolves its 800px sibling. Those are different files, so the browser cannot reuse the download.
- The main gallery and its warmers currently request 800px, while other preload/responsive paths can select 1200px. The page needs one consistent product-page photo address throughout.
- Gallery slides receive image addresses immediately. An additional warmer prepares the active, next and previous/wrapped-last slides on opening. Hiding thumbnails does not stop these requests.
- Similar designs requests a nominal 160px image, but the existing upload family has no tiny variant: the resolver returns 800px. Visible tiles also trigger product data, page-code and photo preparation after a short delay.
- Small category icons and collage pieces have the same issue: asking for 96–160px does not create a smaller file. Category-only legacy photos and raw imports can also remain large originals.
- Browser `loading="lazy"` and `content-visibility` do not enforce a strict request budget. They can still fetch beyond the screen.
- Broad automatic page preparation includes account, tracking, wishlist, search, cart and checkout code. This is not all needed during the first photo’s download.

## Target behavior

| Where | Initial photo policy | After interaction |
|---|---|---|
| Mobile category | First four card photos initially; allow up to six when needed to fill a taller visible area. Existing modern card files stay 800px. | Activate later rows just before scrolling reaches them. |
| Wider category screens | Enough 800px card photos to fill the visible grid. | Activate subsequent rows as approached. |
| Product page | Exactly one full-size main photo: 1200px where that file exists. No separate 800px main-photo warmer. | Swipe/arrow/variant selection activates only the needed gallery photo. |
| Similar designs | Only visible genuine small thumbnails; no automatic destination-product preparation. | Hover, keyboard focus, or deliberate tap prepares the selected destination’s 1200px photo and details. |
| Category icons/collages | Genuine thumbnails sized for their small display; horizontal off-screen icons wait. | Further icons/sections activate when approached. |
| Zoom | No 2000px download while closed. | Opening zoom loads the active photo’s 2000px file, using the displayed photo until ready. |
| Homepage | Opening visible photos only; no distant carousel/lower-section image requests. | Scroll or carousel movement activates additional photos. |

“One photo initially” means **one full-size product photo**, not removal of the store logo or visible tiny graphics. If the current product also appears in Similar designs, reuse its main-photo URL rather than download an additional thumbnail merely for that selected tile.

## Implementation order

### 1. Remove duplicate photo downloads first

- Define one consistent card-photo policy and one product-page-photo policy.
- Update category early preloads, navigation warmers, card rendering and edge-produced HTML to use the **exact same existing card URL**. Preserve the early first-photo advantage instead of simply removing all preloads.
- Align product-page early preloads, transition placeholders, gallery rendering, warmers, video posters that reuse the first photo, and any sticky product preview to the same main-photo URL.
- Make early loading route-aware: category uses its category products, product page uses its current product, homepage uses homepage content. Do not preload home banners/products on category or product entry, including cache/fallback paths.
- Only the main LCP candidate gets high fetch priority; other initial category cards remain eager but do not all compete at high priority.
- Preserve existing 400px legacy card families, single-file 800px uploads and raw Meesho media. **Never fabricate 800/1200/2000 siblings that do not exist.** Legacy single-file media loads once using its known-good file.

### 2. Enforce scroll/swipe-based loading

- Gate actual photo `src`/`srcSet` assignment, rather than relying only on browser lazy loading. Keep card/slide placeholders mounted with stable dimensions.
- Use viewport-based activation for grid rows and section-based activation for below-page recommendations/review media. Use each horizontal rail as the visibility boundary for its images.
- Initially activate only the first gallery photo. Remove automatic next/last gallery warming at mount. Activate the destination slide as a deliberate swipe begins or a control/variant selects it; retain previously loaded slides for instant return swipes.
- Keep video bytes deferred until playback and avoid loading an off-screen video poster on opening.
- Preserve carousel geometry, accessible controls and a safe fallback for browsers without visibility observers. Native lazy loading remains a secondary safeguard.
- Prevent unattended homepage autoplay from progressively downloading the whole catalogue before the shopper engages; keep motion available after the section is visible and main photo has settled, with bounded photo preparation.

### 3. Separate thumbnails from full-size photos

- Remove the visibility-triggered `prefetchProductDetail` call from Similar designs. Visibility may activate the tiny photo only.
- Keep destination preparation on clear user intent. Do not let merely scrolling a finger across the rail prepare multiple unrelated full-size product pages. Skip preparing the current product again.
- Add independently stored, sharp small-display derivatives: approximately **160–200px for similar-design tiles**, **96–128px for tiny category icons**, and **appropriate larger thumbnails for homepage collage pieces**, accounting for high-density displays.
- Keep all existing 800/1200/2000 photos and raw Meesho originals untouched. Separate tiny derivatives are optional display assets, not replacements or recompression of imported originals.
- Generate future derivatives from the existing original decode and backfill only the photos actually used by icons/curated tiles first. Store explicit thumbnail addresses or verified metadata; never assume a filename exists.
- Until a thumbnail is verified, reuse an already-loaded photo when possible or use the known-good existing source with strict visibility gating. Do not silently substitute broken thumbnail URLs.
- Use protected, bounded background processing for any backfill, without customer-browser transformation work or exposing storage credentials. Retain previous thumbnails until replacements upload successfully.

### 4. Stabilize spacing and reduce unnecessary opening work

- Match placeholders to each theme’s real photo/card aspect ratio; reserve category rows, gallery, Similar designs, reviews/recommendations and homepage carousel space.
- Keep Imitation World’s existing 92px mobile/108px desktop Similar designs reservation: it is already present and should not be removed. Preserve the heading’s opening-screen visibility.
- Prevent homepage Best Selling loading states from collapsing to zero height and expanding later. Keep gallery measurements from resizing the page after the photo decodes; use existing dimensions or a stable store-specific frame.
- Replace the broad automatic route-preparation wave with bounded, intent-based preparation. Prioritize actual product selection, cart opening and Buy Now over unrelated account/search/tracking routes. Remove the duplicate checkout import entry, without claiming it causes a second network download—module imports are cached.
- Keep only the active store/theme fonts on storefront visits, eliminate duplicate Worker/React font injection, and avoid loading unused weights. Preserve the merchant’s chosen typography and existing optional font-display policy.
- Keep necessary shopping state and advertising initialization. Do **not** disable Pixel/CAPI or delay required events merely to increase a performance score.

### 5. Repeat cold-entry tests and validate shopping

Test fresh sessions with cache disabled on both mobile and desktop, including a slow connection/CPU profile. Separate the opening screen from a 30–40 second idle/no-scroll window so delayed overfetch is visible.

- Direct category: modern card-family requests are 800px only; no 1200/2000 product photos before interaction. Record initial card count, icon count, transferred bytes and later-row activation.
- Direct PDP: one initial 1200px full-size photo where available; no extra 800px main photo, no 2000px, no unselected gallery photos or unrelated full-size Similar designs photos. Report tiny thumbnails/logos separately.
- Verify fresh and cached edge HTML, preview fallback, category-to-PDP navigation, PDP-to-PDP taps, refresh and browser back/forward.
- Test single-photo, multi-photo, video, variant, raw imported, legacy 400px-card and single-file 800px products across shared/default and V19/V20/V22 product-page paths.
- Swipe both ways rapidly; verify no broken slides, lost controls, unintended video downloads or jump in photo framing. Open zoom and verify only its requested high-resolution photo loads; close/reopen and confirm cache reuse.
- Verify Similar designs keeps all 13 items in the supplied order, current selection, full-cover tile styling and fast taps; unrelated stores remain unchanged.
- Test add-to-cart, quantity/variant selection, Buy Now and checkout up to the payment handoff using safe test data. No real payment/order/message solely for this audit without approval.
- Verify PageView, ViewContent, AddToCart and InitiateCheckout on their correct actions with no duplicate firing from prefetch. Validate Purchase deduplication using tests/sandbox or an authorized real order, not a fabricated production purchase.
- Run relevant automated tests and inspect current build/runtime errors. Repeat each key cold-entry case at least three times; compare median LCP, CLS, initial bytes and request counts. Aim for CLS ≤0.1 and LCP ≤2.5s, but report measured outcomes rather than guarantee a score.

## Technical implementation areas

- Shared URL/variant rules: `src/lib/imageOptimize.ts`, `src/lib/uploadOptimizedImage.ts`; add focused tests for modern/legacy/raw media.
- Early entry loading: inline category/PDP loaders in `index.html`, product transition placeholders, `prefetchCategory.ts`, `prefetchProductDetail.ts`.
- Production edge parity: `docs/cloudflare-worker-current.js` preload builders, Link headers, skeleton image addresses and route/cache fallbacks. Keep bootstrap and React rules equivalent; document the consistency contract in `AGENTS.md`.
- Visibility gates: category/shared cards, category quick-jump/collage components, standard and V19/V20/V22 galleries, zoom thumbnails, homepage and below-page rails.
- Imitation World-specific rail: `ImitationWorldSimilarDesigns.tsx` and its regression tests.
- Scripts/fonts: `prefetchStorefrontRoutes.ts`, applicable storefront layouts and existing font-owner markers; only change verified redundant work.

## Rollout and safeguards

1. Capture/retain the baseline and add URL/request-budget tests.
2. Ship duplicate-removal and explicit activation first; verify Imitation World and representative other themes.
3. Introduce verified small thumbnails and bounded backfill, then spacing/script/font adjustments.
4. Deploy and purge only changed storefront HTML/data caches when necessary. **Worker changes require your separate manual Cloudflare deployment**; app changes alone cannot remove old edge-injected preloads.
5. Repeat tests against the actual deployed custom domain before claiming the production fix complete. Keep a rollback path for each stage and avoid mass image replacements or database/API signature changes.

**This is the implementation plan; storefront behavior has not been changed yet.**