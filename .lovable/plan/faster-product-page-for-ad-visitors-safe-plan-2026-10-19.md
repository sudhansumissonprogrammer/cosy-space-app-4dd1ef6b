# Faster product page for ad visitors (safe plan)

## What I measured
Kalinga Jewels product page, simulated mid-range Android on slow 4G, fresh visit, 2 runs:

| Step | Time |
|---|---|
| Server answers | 0.9–1.4 s |
| First thing visible (logo/header) | 1.5–2.1 s |
| Main product photo fully shown | ~6.8–7.5 s |
| Everything finished | ~19 s |

Downloaded on opening: about 1.5 MB of photos (22–24 photos), 670 KB of scripts (63 files), 120 KB fonts.

## What is actually slowing it
1. **The main photo starts early but finishes late (1.4 s -> 7.5 s).** It shares the slow phone connection with about 22 other photos, 4 fonts, and the Facebook scripts (about 260 KB) that all download at the same time.
2. **Too many photos load on opening.** These include Similar Designs tiles, review photos, the care-guide slide and logos. Only the main photo is needed at first.
3. **Files load in a chain, one after another.** The product page code only starts downloading at about 6.4 s, because it waits for 4 earlier steps to finish first.
4. **The main photo is a 1200px file.** A phone screen needs about 800px of it.
5. **Extra scripts at opening:** an editor badge script and an analytics script, which shoppers don't need.

The category page feels faster because its photos are smaller and its code chain is shorter.

## Safe fixes (in order, each small and reversible)
1. **The main photo comes first.** All other photos (Similar Designs, reviews, care guide, logo extras) wait until the main photo has shown or the shopper scrolls. Expected: main photo about 2–3 s sooner.
2. **800px main photo on phones** when that size already exists for the product. It switches to the sharp 1200px version for zoom or swipe. Original photos are never changed or re-compressed.
3. **Start loading the product page code right away** for /product links, instead of waiting for the chain. Expected: about 1.5–2 s saved.
4. **Facebook pixel loads after the main photo shows** (at most about 1.5 s later). All events still fire, including PageView and ViewContent, and nothing is lost.
5. **Only 2 fonts at opening** (the ones the title uses). The others load later.
6. **Turn off the editor badge script** on live stores (this is a publish setting).

Target: main photo in about 3–3.5 s on slow 4G (now about 7 s). Faster on normal 4G/Wi-Fi.

## Safety while ads run
- Changes 1–5 apply to every store, but each is a loading-order change only. Prices, cart, checkout, payments and pixel events stay the same.
- After each change I re-measure the same pages on a simulated phone. I check that the pixel still fires PageView, ViewContent and AddToCart, and that add-to-cart and checkout still open.
- Ship one change at a time, so any single change can be undone.

## Technical details
- Defer non-main images: gate SimilarRail, review media, care-guide slide and upsell images behind the existing GalleryImage readiness signal or first scroll (CardImageReadiness pattern).
- Mobile hero uses the 800w card sibling via the existing path-timestamp rule (it falls back to canonical 1200w). Zoom keeps using 2000w on demand.
- Add `<link rel="modulepreload">` for the ProductDetail and StorefrontLayoutV16 chunks when the path starts with /product, in index.html, Worker-side.
- Load fbevents after the main image `load` event or a 1.5 s timeout. The fbq queue stub is kept, so events stay queued.
- Font preload limited to the heading font plus the 400 weight. The rest use font-display:optional.
