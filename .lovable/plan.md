# Add "About Us" Storefront Page

## Overview

Create a dedicated About Us page for every storefront, auto-populated from store data (name, description, location, social links) with emoji-enriched default content. Store owners can optionally upload a photo and write custom "About Us" text via Store Settings — if custom text is provided, the default auto-generated content is hidden.

## Database Migration

Add two new columns to the `stores` table:

- `about_us_text TEXT NULL` — custom About Us content (if blank, show auto-generated default)
- `about_us_image_url TEXT NULL` — optional photo displayed on the About Us page

Also update the `get_storefront_data` and `get_storefront_shell` DB functions to include these two new fields in the returned JSON.

## Changes

### 1. New page: `src/pages/StorefrontAboutUs.tsx`

- Uses `useOutletContext<StoreData>()` (same pattern as StorefrontContact)
- Hero section with store logo and "About {store.name}" heading
- If `store.about_us_text` exists, render it (with optional about image) and hide default content
- If blank, render auto-generated content using store description, location, features, social links — with emojis (🏪 Our Story, 📍 Where to Find Us, ✨ Why Choose Us, 📱 Connect With Us)
- Shows the uploaded `about_us_image_url` photo if available

### 2. Route registration: `src/App.tsx`

- Add lazy import for `StorefrontAboutUs`
- Add `<Route path="about" element={<StorefrontAboutUs />} />` in `storefrontChildRoutes`

### 3. Navigation — add "About Us" to all layout side menus

Update these files to add an "About Us" link alongside "Contact Us":

- `src/layouts/StorefrontLayout.tsx` — slide menu nav
- `src/layouts/StorefrontLayoutV2.tsx` — slide menu
- `src/layouts/StorefrontLayoutV3.tsx` — slide menu
- `src/layouts/StorefrontLayoutV10.tsx` — slide menu + footer
- `src/layouts/StorefrontLayoutV11.tsx` — slide menu + footer
- `src/layouts/StorefrontLayoutV12.tsx` — slide menu + footer
- `src/layouts/StorefrontLayoutV13.tsx` — slide menu + footer

### 4. Footer: `src/components/storefront/StorefrontFooter.tsx`

- Add "About Us" link to Quick Links column (between Home and Contact Us)

### 5. Store Settings: `src/pages/StoreSettings.tsx`

- Add new "About Us Page" section with:
  - Image upload field for `about_us_image_url` (same pattern as banner upload)
  - Textarea for custom `about_us_text`
  - Helper text: "Leave blank to use auto-generated About Us content"
- Include both fields in the save mutation

### 6. Sitemap: `supabase/functions/seo-page/index.ts`

- Add `/about` and `/contact` to the static pages list in the sitemap builder (alongside privacy-policy, return-policy, etc.)

### 7. Update DB functions

Update `get_storefront_data` and `get_storefront_shell` to include `about_us_text` and `about_us_image_url` in the returned store JSON.

## Technical Notes

- The About Us page follows the exact same pattern as `StorefrontContact.tsx` (uses outlet context, same styling approach)
- No new tables needed — just two columns on `stores`
- The auto-generated content uses store fields that already exist (description, location, city, state, features, social URLs)
-  also add social icon social medial detils