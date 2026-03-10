## Auto-Compress Images on Upload

### Problem

Uploading 4-6MB photos across 30-50 products results in ~200MB of uncompressed images, causing slow storefront loading.

### Solution

Create a shared `compressImage` utility that uses the browser's Canvas API to resize and compress every image before uploading to storage. No external libraries needed and quality not should reduce.

### How It Works

1. **Create `src/lib/imageCompression.ts**` -- a utility function that:
  - Takes a `File` input
  - Draws it onto a `<canvas>` element
  - Resizes to max 1200px width/height (maintains aspect ratio)
  - Exports as WebP at 0.8 quality
  - Target output: 100-200KB depending on image complexity
  - Falls back to JPEG if WebP isn't supported
  - Returns a new `File` object ready for upload
2. **Integrate into all 4 upload locations:**
  - `**ProductForm.tsx**` -- main product image + additional gallery images + category images (3 upload paths)
  - `**CreateStore.tsx**` -- store logo and banner uploads
  - `**StoreSettings.tsx**` -- store logo and banner updates
  - `**UserSettings.tsx**` -- avatar upload
3. **Integration pattern** -- before each `supabase.storage.from(...).upload(path, file)` call, compress first:
  ```
   const compressed = await compressImage(file);
   // then upload compressed instead of file
  ```
   The file extension in the storage path changes to `.webp`.
4. quality not should reduce.

### What Changes Per File


| File                             | Upload points modified                 |
| -------------------------------- | -------------------------------------- |
| `src/lib/imageCompression.ts`    | New file (compression utility)         |
| `src/components/ProductForm.tsx` | `uploadImage()`, category image upload |
| `src/pages/CreateStore.tsx`      | `uploadFile()`                         |
| `src/pages/StoreSettings.tsx`    | `uploadFile()`                         |
| `src/pages/UserSettings.tsx`     | avatar upload block                    |


### Result

- 4-6MB photos automatically compressed to ~100-200KB
- All images stored as WebP (better compression than JPEG/PNG)
- Max dimension 1200px (sufficient for storefront display)
- No visible quality loss on screen
- Storefront loads significantly faster