

## Plan: Mobile-Only Hero Banner Image

### What We're Building
A mobile-only hero banner section on the storefront (like the reference image showing "Elevate Your Everyday Style" with product photos). Users can optionally upload this image during store creation. It displays below the categories section, visible only on mobile (`block md:hidden`).

### Database Change
Add a `mobile_hero_url` column to the `stores` table:
```sql
ALTER TABLE public.stores ADD COLUMN mobile_hero_url text DEFAULT null;
```

### Code Changes

**1. `src/pages/CreateStore.tsx`** — Add hero image upload field in Step 1
- Add `heroFile` / `heroPreview` state
- Add a new upload section after Logo + Banner with label "Mobile Hero Banner (optional)" and a "Skip" note
- On submit, compress the image (targeting 200-300KB via `compressImage` with adjusted quality) and upload to `store-banners` bucket, save URL as `mobile_hero_url`

**2. `src/lib/imageCompression.ts`** — Add a higher target variant
- Create a `compressImageForHero` wrapper or pass `maxSize` param to allow 200-300KB target instead of the default 100-200KB

**3. `src/components/storefront/StorefrontMobileHero.tsx`** — New component
- Simple component: if `store.mobile_hero_url` exists, render a full-width image with `block md:hidden` (hidden on desktop)
- Image fits naturally to its aspect ratio, no cropping

**4. `src/pages/StorefrontHome.tsx`** — Render the hero
- Import and place `StorefrontMobileHero` right after `StorefrontCategories`

**5. `src/pages/StoreSettings.tsx`** — Allow updating the hero image later (optional but useful)
- Add upload/remove field for mobile hero banner in store settings

### Flow
1. User creates store → sees optional "Mobile Hero Banner" upload in Step 1
2. If uploaded, image is compressed to ~200-300KB and stored
3. On the storefront, mobile visitors see the hero image below categories; desktop visitors don't see it

