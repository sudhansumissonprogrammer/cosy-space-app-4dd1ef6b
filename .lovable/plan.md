# Product Video Upload — Flipkart-style PDP Video

## Goal

Merchant uploads ONE video per product from the product form. On PDP, the video appears as **slide #2** of the existing image carousel (image #1 always first, video always second, remaining images after) — exactly like Flipkart. Video must:

- Compress hard client-side (no quality loss, big size cut)
- Add **zero load impact** to PDP (no extra blocking JS, no auto-download of MP4)
- Stream via R2 + cdn.shopbanao.in with byte-range support already in place

## How Flipkart does it (for reference)

- One short product video per listing (~10–30s)
- Server-side transcoded to H.264 MP4 + HLS, ~720p
- Embedded as slot 2 in the image carousel
- `<video>` with poster (first frame). Click to play. `preload="none"` until slide is visible.
- Hover/swipe-into-view → `preload="metadata"`, tap → `preload="auto"` + play

We'll match this with a **simpler stack** (no HLS) since R2 + browser-native MP4 playback over byte-range is plenty for product videos.

## Constraints / rules

- Max 1 video per product (simple, matches Flipkart pattern)
- Hard cap: 60s, 100 MB raw upload, 720p output
- Output: H.264 MP4, CRF 26, AAC 96k mono, ~1.2–1.8 Mbps → typical 30s phone clip 80 MB → ~4–6 MB
- Compression runs client-side via lazy-loaded ffmpeg.wasm chunk (~25 MB) — loaded ONLY when merchant picks a video file, never on PDP, never on any other dashboard page
- Video element on PDP: `preload="none"`, `playsInline`, `controls`, `poster={firstImage}` → no bytes fetched until user scrolls to slide #2 / taps play. PDP load time unchanged.

## Implementation

### 1. Database — single migration

```sql
ALTER TABLE public.products
  ADD COLUMN video_url   text,
  ADD COLUMN video_poster_url text;  -- optional cached first-frame thumb
```

- No new table (single video = single column, matches Flipkart)
- Existing RLS already covers `products` row updates
- Update `get_storefront_data` / shell RPCs to **select these two new columns** (drop-first the existing overload per project rule)

### 2. Edge function — extend `r2-upload`

- Allow MIME types `video/mp4`, `video/webm`
- For video MIME: **skip** the jSquash WebP conversion branch, PUT bytes straight to R2
- Add new logical bucket prefix `"product-videos"` to `ALLOWED_BUCKETS`
- Keep the same SigV4 PUT path → served via `cdn.shopbanao.in/product-videos/...`
- Set `Content-Type: video/mp4` and `Cache-Control: public, max-age=31536000, immutable` on PUT so R2 serves with the right headers (browsers honour byte-range automatically)

### 3. Client compression util — new `src/lib/uploadCompressedVideo.ts`

- Dynamic `import("@ffmpeg/ffmpeg")` + `import("@ffmpeg/util")` so the wasm bundle is a separate chunk, lazy-loaded only when called
- Pipeline:
  1. Validate: ≤60s duration, ≤100 MB, MIME starts with `video/`
  2. Transcode: `-c:v libx264 -preset veryfast -crf 26 -vf scale='min(720,iw)':-2 -c:a aac -b:a 96k -movflags +faststart -t 60`
    - `+faststart` puts moov atom up front → instant playback start
    - Caps to 720p, preserves aspect
  3. Show progress to merchant via ffmpeg `progress` event
  4. POST to `r2-upload` with `bucket: "product-videos"`, `path: "{userId}/{storeId}/{ts}-{rand}.mp4"`
- Also extracts first frame as JPEG (`-ss 00:00:00 -frames:v 1`) → uploads as `video_poster_url` (used as `<video poster>` and as 2nd-slide thumb in the carousel strip)

### 4. ProductForm UI (`src/components/ProductForm.tsx`)

- New section below "Additional Images" titled **"Product Video (optional)"**
- File input accepting `video/*`
- On select:
  - Show "Compressing video…" with % progress
  - Call `uploadCompressedVideo()` → store returned URLs in form state
  - Preview thumbnail (the poster) with "Replace" / "Remove" buttons
- On submit: write `video_url` + `video_poster_url` to the products UPDATE/INSERT
- On product delete or video remove: best-effort, leave R2 objects (we don't currently garbage-collect images either)

### 5. PDP gallery (`src/pages/ProductDetail.tsx`)

Replace the simple string array at line 484-489 with a typed slide array:

```ts
type Slide = { kind: "image"; url: string } | { kind: "video"; url: string; poster: string };

const allSlides: Slide[] = (() => {
  const imgUrls: string[] = [];
  if (product?.image_url) imgUrls.push(...splitImageUrls(product.image_url));
  if (extraImages) imgUrls.push(...extraImages.map(i => i.image_url));

  const slides: Slide[] = [];
  if (imgUrls[0]) slides.push({ kind: "image", url: imgUrls[0] });
  if (product?.video_url) {
    slides.push({
      kind: "video",
      url: product.video_url,
      poster: product.video_poster_url || imgUrls[0],
    });
  }
  for (let i = 1; i < imgUrls.length; i++) slides.push({ kind: "image", url: imgUrls[i] });
  return slides;
})();
```

This guarantees: **image #1 → video → remaining images**, regardless of how many images exist.

In the Embla carousel render:

- Image slide: existing `<img>` code
- Video slide:
  ```tsx
  <video
    src={slide.url}
    poster={slide.poster}
    preload="none"        // <-- zero bytes until user interacts
    playsInline
    controls
    className="w-full h-full object-contain bg-black"
  />
  ```
- Thumbnail strip: show poster image with a play-triangle overlay

**Result**: PDP HTML/JS payload increases by 0 bytes for products without a video; for products with one, only the poster (30 KB JPG) is fetched. The actual video MP4 is fetched only when the user taps play.

### 6. Storefront data path

- Update `get_storefront_data` RPC to include `video_url, video_poster_url` in the product row JSON
- Update the cached `ProductDetail` query selector to fetch the new columns
- Bump worker SS cache key generation only if needed — column addition is additive, existing cached entries still work, new fetches naturally pick up the columns

### 7. Cards/listings — explicitly NOT touched

- Product cards stay image-only (Flipkart parity, avoids autoplay storm on listing pages)
- Video only renders on PDP

## Files changed

- `supabase/migrations/<new>.sql` (add columns, update RPCs)
- `supabase/functions/r2-upload/index.ts` (allow video MIME + bucket, skip WebP path)
- `src/lib/uploadCompressedVideo.ts` (new)
- `src/components/ProductForm.tsx` (upload UI + form state + insert/update)
- `src/pages/ProductDetail.tsx` (Slide type + carousel render)
- `src/integrations/supabase/types.ts` — auto-regenerated, do not hand-edit
- `package.json` — add `@ffmpeg/ffmpeg`, `@ffmpeg/util` (lazy chunk, not in main bundle)

## Performance guarantees

- **PDP cold load**: unchanged. Video element with `preload="none"` fetches 0 bytes. Poster is a ~30 KB JPG.
- **First paint / LCP**: unchanged — slide #1 is still the image, video is slide #2 (off-screen on initial paint).
- **Bundle size**: ffmpeg.wasm is in its own dynamic chunk (~25 MB) loaded only when a merchant clicks the video file picker on the product form. Never loaded by storefront, PDP, or any other dashboard page.
- **Storage cost**: ~5 MB/video avg on R2 → $0.000075/video/month. Negligible.

## Rollout

1. Migration + RPC update
2. Edge fn update + manual redeploy
3. Client code (form + PDP + util)
4. Test on one product end-to-end on staging subdomain before announcing also amke it no impace in website cold load if a store have 100 product habe 100 video that shoudl not make imact or reduee load time loloaad time shodul of websote should fast liek in website coloload no video shoudlsixe download it on when pdp page pade send scroll when vido open make it  do deep anlys make