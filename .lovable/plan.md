# Cold-entry photo loading: category, product page and homepage

## What this fixes

Category cards should download their **800px card photo**, not download a second **1200px product-page photo** before the shopper opens that product. A direct product-page visit should start with **one 1200px main photo**, with other gallery photos waiting for a swipe and **2000px reserved for zoom**.

Keep existing sharp photos, sale badges, store branding, Similar designs, shopping and advertising measurement intact. Apply shared loading corrections across storefronts; keep Imitation World’s compact gallery, hidden gallery thumbnails and curated Similar designs strip exclusive to that store.

## Verified findings

Saved fresh-browser Imitation World tests, approximately 40 seconds without scrolling; not universal counts.

| Tested entry | Product/category photo files downloaded | What happened |
|---|---:|---|
| Chain with Pendant category | 17 | Six 1200px product photos, eight 800px card photos, and three category-navigation photos. Six products downloaded in both sizes. |
| Tested pendant product page | 8 | One 1200px main photo, the same product’s 800px photo, and six other products’ 800px photos for Similar designs. |

The product page also downloaded logos, sale/payment/trust graphics: **19 distinct image URLs overall**, versus eight product-photo URLs. **No 2000px photo was observed before zoom.** Therefore, the evidence does **not** say all three sizes download at opening. It says 800px and 1200px duplicated the main photo, while the supposedly small similar photos were actually 800px files.

### Why this happens

- Early category preloads use stored 1200px URLs; cards resolve 800px siblings, so downloads cannot be reused.
- PDP warmers request 800px while preload/responsive paths can select 1200px. Gallery slides receive photo addresses immediately, plus automatic next/last-slide preparation.
- Similar designs asks for 160px, but no tiny variant exists: the resolver returns 800px. Visibility also triggers unrelated PDP data/code/photo preparation.
- Small category icons/collages similarly resolve large existing photos; requesting 96px does not create a 96px file.
- Browser lazy loading and skipped off-screen painting do not enforce download limits. Broad automatic route preparation also loads unnecessary code.

## Target behavior

| Area | Opening | Later |
|---|---|---|
| Mobile category | First four existing 800px card photos; up to six if needed to fill a taller screen | Later rows activate as scrolling approaches |
| Wider category | Enough 800px cards for the visible grid | Further rows activate as approached |
| PDP | One 1200px main photo where available | Swipe/control/variant activates needed slide |
| Similar designs | Visible genuine tiny thumbnails; no unrelated PDP preparation | Intent prepares selected destination |
| Category icons/collages | Appropriate tiny files, visible items only | Off-screen items activate as approached |
| Zoom | No 2000px while closed | Active 2000px photo when opened |
| Homepage | Visible opening photos only | Scroll/carousel interaction activates more |

“One photo” means one **full-size** photo, not removal of visible logos or small graphics. Reuse the main photo for its selected Similar designs tile rather than fetch another file.

## Implementation order

### 1. Remove duplicate photo downloads first

- Update category early preloads, navigation warmers, card rendering and edge-produced HTML to use the **exact same existing card URL**. Preserve the early first-photo advantage instead of simply removing all preloads.
- Align product-page early preloads, transition placeholders, gallery rendering, warmers, video posters that reuse the first photo, and any sticky product preview to the same main-photo URL.
- Make early loading route-aware: category uses its category products, product page uses its current product, homepage uses homepage content. Do not preload home banners/products on category or product entry, including cache/fallback paths.
- Only the main LCP candidate gets high priority; other opening cards remain eager.
- Preserve existing 400px legacy card families, single-file 800px uploads and raw Meesho media. **Never fabricate 800/1200/2000 siblings that do not exist.** Legacy single-file media loads once using its known-good file.

### 2. Enforce scroll/swipe-based loading

- Gate actual photo `src`/`srcSet` assignment, rather than relying only on browser lazy loading. Keep card/slide placeholders mounted with stable dimensions.
- Use viewport-based activation for grid rows and section-based activation for below-page recommendations/review media. Use each horizontal rail as the visibility boundary for its images.
- Initially activate only the first gallery photo. Remove automatic next/last gallery warming at mount. Activate the destination slide as a deliberate swipe begins or a control/variant selects it; retain previously loaded slides for instant return swipes.
- Keep video bytes deferred until playback and avoid loading an off-screen video poster on opening.
- Preserve carousel geometry, accessibility and observer fallbacks. Native lazy loading is a secondary safeguard.
- Prevent unattended homepage autoplay from progressively downloading the whole catalogue before the shopper engages; keep motion available after the section is visible and main photo has settled, with bounded photo preparation.

### 3. Separate thumbnails from full-size photos

- Remove the visibility-triggered `prefetchProductDetail` call from Similar designs. Visibility may activate the tiny photo only.
- Prepare destinations on clear intent, not incidental rail scrolling; skip the current product.
- Add independently stored, sharp small-display derivatives: approximately **160–200px for similar-design tiles**, **96–128px for tiny category icons**, and **appropriate larger thumbnails for homepage collage pieces**, accounting for high-density displays.
- Keep 800/1200/2000 photos and raw Meesho originals untouched; tiny derivatives are separate display assets.
- Generate derivatives from the original decode; first backfill only icon/curated-tile photos. Store verified thumbnail addresses; do not guess filenames.
- Before a thumbnail is verified, reuse loaded photos or visibility-gate the known-good source; never use nonexistent URLs.
- Backfill through protected, bounded processing—not shoppers’ browsers. Keep prior thumbnails until replacements upload.

### 4. Stabilize spacing and reduce unnecessary opening work

- Match placeholders to each theme’s real photo/card aspect ratio; reserve category rows, gallery, Similar designs, reviews/recommendations and homepage carousel space.
- Preserve Imitation World’s existing 92px mobile/108px desktop Similar designs reservation and opening-screen heading visibility.
- Prevent homepage Best Selling loading states from collapsing to zero height and expanding later. Keep gallery measurements from resizing the page after the photo decodes; use existing dimensions or a stable store-specific frame.
- Replace broad route preparation with bounded user-intent loading. Prioritize product selection, cart and Buy Now. Remove the duplicate checkout import entry; cached module imports do not necessarily download twice.
- Keep only the active store/theme fonts on storefront visits, eliminate duplicate Worker/React font injection, and avoid loading unused weights. Preserve the merchant’s chosen typography and existing optional font-display policy.
- Keep necessary shopping state and advertising initialization. Do **not** disable Pixel/CAPI or delay required events merely to increase a performance score.

### 5. Repeat cold-entry tests and validate shopping

Use fresh cache-disabled sessions on mobile and desktop with a slow network/CPU profile. Report both the opening screen and a 30–40 second idle/no-scroll window, so delayed overfetch cannot hide.

- **Category:** only existing card-size files; no 1200/2000 product photos before interaction. Count initial cards/icons, bytes and later-row activation.
- **PDP:** one initial 1200px full-size photo where available; no duplicate 800px main photo, 2000px, unselected slides or unrelated full-size Similar designs photos. Count tiny graphics separately.
- Test fresh/cached production HTML, preview fallback, category-to-PDP and similar-design navigation, refresh and back/forward.
- Cover single/multi-photo, video, variants, raw imports, legacy 400px-card and single-file 800px products across default and V19/V20/V22 paths.
- Verify rapid swipes, zoom opening/closing and cache reuse; no broken slides or unwanted video downloads. Confirm all 13 ordered Similar designs, current selection, enlarged tiles and opening-screen heading remain correct.
- Verify cart, quantities/variants, Buy Now and checkout up to payment handoff. No real payment/order/message just for testing without approval.
- Verify PageView, ViewContent, AddToCart and InitiateCheckout occur on correct actions, never from prefetch. Validate Purchase deduplication through tests/sandbox or an authorized real order, not a fabricated production purchase.
- Run relevant automated tests and inspect current build/runtime errors. Repeat key cold-entry cases three times and compare median LCP, CLS, initial bytes and requests. Aim for CLS ≤0.1 and LCP ≤2.5s; report results without guaranteeing scores.

## Technical areas and rollout

- Update shared URL/variant helpers; category/PDP bootstrap loaders in `index.html`; category/product prefetch helpers; transition placeholders; shared cards/icons/collages; standard and V19/V20/V22 galleries; zoom; homepage/below-page rails.
- Keep `ImitationWorldSimilarDesigns.tsx` store-gated and update its tests. Adjust route preparation and font ownership only where redundant work is verified. Document the shared loading contract in `AGENTS.md`.
- Align `docs/cloudflare-worker-current.js` preload builders, Link headers, skeleton photo URLs and route/cache fallbacks with React/bootstrap rules.
- Roll out duplicate-removal and activation first, then verified thumbnail backfill, then spacing/script/font improvements. Validate representative other stores at each stage.
- **Worker changes require your separate manual Cloudflare deployment.** App changes alone cannot remove old edge-injected preloads. Purge affected caches and repeat custom-domain tests before claiming production success.
- Preserve rollback points; no mass image replacements, changes to payment logic, or database/API signature changes.

**This is the implementation plan; storefront behavior has not been changed yet.**
