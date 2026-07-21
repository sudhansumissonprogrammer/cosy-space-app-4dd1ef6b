# Shop by Video

App Store add-on. Muted-autoplay Reels-style carousel that automatically surfaces every active product with a `video_url`. Owner controls sequence, title, aspect ratio (9:16 or 4:5), max items, and toggles for autoplay/loop/price/CTA from the dashboard. Renders directly below Best Sellers on the storefront home. Uses the existing `store_apps` table + `get_store_enabled_apps` RPC — no schema change.

## Files added

- `src/components/storefront/ShopByVideoCarousel.tsx` — Embla carousel, IntersectionObserver-gated playback, mute toggle, product title/price/CTA overlay.
- `src/pages/appStore/ShopByVideoConfig.tsx` — Owner dashboard config: enable switch, look & feel, sequence reorder, live preview.

## Files modified

- `src/lib/appStore/registry.ts` — Registered `shop-by-video` app id, defaults, Film icon.
- `src/pages/StorefrontHome.tsx` — Lazy mount of `ShopByVideoCarousel` directly below Best Sellers.
- `src/components/storefront/HomeSharedSections.tsx` — Added `HomeShopByVideoSection` for shared V10/V12 layouts (mount below `HomeBestSellingSection`).

## Dependencies

All already in project: `embla-carousel-react`, `embla-carousel-autoplay`, `lucide-react`.

## Backend assumptions

- `store_apps` table with `(store_id, app_id, enabled, config jsonb)` — reused (no migration).
- `get_store_enabled_apps(_store_slug text)` RPC returning `(app_id, config)` — reused.
- `products.video_url` + `products.video_poster_url` columns already exist and are populated by the existing Product Form.

## Config shape

```json
{
  "title": "Shop by Video",
  "autoplay": true,
  "loop": true,
  "aspect_ratio": "9:16",
  "max_items": 10,
  "show_price": true,
  "show_cta": true,
  "order": ["<productId>", "..."]
}
```

## Extraction prompt (paste in main project chat)

> Add a new App Store add-on called **Shop by Video** to my project. It should behave exactly like the sandbox implementation of the same name — copy `src/components/storefront/ShopByVideoCarousel.tsx` and `src/pages/appStore/ShopByVideoConfig.tsx` verbatim, register it in `src/lib/appStore/registry.ts` with icon `Film`, default config `{ title: "Shop by Video", autoplay: true, loop: true, aspect_ratio: "9:16", max_items: 10, show_price: true, show_cta: true, order: [] }`, and mount `<ShopByVideoCarousel storeSlug={slug!} storeId={store.id} />` directly below the Best Sellers section on `StorefrontHome.tsx` and inside `HomeSharedSections.tsx` (for V10/V12). No DB migration is required — reuse the existing `store_apps` table and `get_store_enabled_apps` RPC. Products auto-qualify when `products.video_url` is set; owner reorders them from the config page.