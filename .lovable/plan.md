

## Plan: Differentiated Image Compression for CSV Bulk Upload vs Manual Upload

### What Changes

Currently, CSV bulk upload copies external images to storage **without any compression** (raw copy via edge function). Manual uploads compress heavily (~95% size reduction) via client-side canvas.

**New behavior:**
- **CSV bulk upload images**: Download → compress to **50% of original file size** (light compression, high visual quality) → upload to storage
- **Manual upload** (product form, media library): No change — keeps current heavy compression (~95% reduction)

### Why Client-Side Compression

The edge function (`image-ops/handleCopy`) runs on Deno which lacks Canvas API or native image libraries. Compression must happen client-side using the existing canvas-based pipeline.

### Technical Steps

**1. Add a `processImageFromUrl()` function in `imageCompression.ts`**
- Fetches an image from a URL, creates a canvas, and compresses targeting **50% of original size**
- Uses quality=0.92 (high) and iterates down only to achieve 50% reduction
- Minimum quality floor: 0.80 (never degrades visually)
- Returns a compressed `File` object

**2. Create `compressAndUploadExternalImages()` in `externalImageCopy.ts`**
- New function that replaces `copyExternalImagesForProducts` for CSV flow
- For each external image URL:
  1. Fetch image as blob → create File
  2. Call `processImageFromUrl()` with 50% target
  3. Upload compressed file to `product-images` storage bucket
  4. Update product `image_url` in database
- Processes sequentially with 500ms delays to avoid overload
- Fire-and-forget (non-blocking)

**3. Update `BulkUpload.tsx` onSuccess handler**
- Replace `copyExternalImagesForProducts()` call with new `compressAndUploadExternalImages()`
- Same fire-and-forget pattern, just uses client-side compression instead of edge function raw copy

**4. No changes to manual upload flow**
- `ProductForm`, `MediaLibrary`, and gallery uploads continue using existing `processImage()` / `processImageMultiSize()` with current heavy compression settings

### Files Modified
- `src/lib/imageCompression.ts` — add `processImageFromUrl()` with 50% target mode
- `src/lib/externalImageCopy.ts` — add `compressAndUploadExternalImages()` using client-side compression + direct storage upload
- `src/pages/BulkUpload.tsx` — switch to new compression function in onSuccess

