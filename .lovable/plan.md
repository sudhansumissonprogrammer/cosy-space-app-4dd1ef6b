

## Facebook Pixel Integration Plan

### 1. Database Migration
Add `facebook_pixel_id` column (text, nullable) to the `stores` table.

### 2. Store Settings UI (`src/pages/StoreSettings.tsx`)
- Add state variable `facebookPixelId`
- Pre-populate from store data in useEffect
- Add input field in a new "Tracking & Analytics" Card section with label "Facebook Pixel ID" and placeholder "e.g. 123456789012345"
- Include it in the update mutation payload

### 3. Facebook Pixel Hook (`src/hooks/useFacebookPixel.ts`)
Create a custom hook that:
- Accepts the store's `facebook_pixel_id`
- On mount, injects the FB Pixel base script (`fbq('init', pixelId)` + `fbq('track', 'PageView')`) into `<head>` if not already present
- Exposes a `trackEvent(eventName, params)` function for firing standard events
- Cleans up script on unmount/pixel change

### 4. Inject Pixel in StorefrontLayout (`src/layouts/StorefrontLayout.tsx`)
- Call `useFacebookPixel(store.facebook_pixel_id)` after store loads
- This auto-fires `PageView` on every storefront page load

### 5. Track Standard Events
- **ViewContent** — `src/pages/ProductDetail.tsx`: fire when product data loads with `content_name`, `content_ids`, `content_type: 'product'`, `value`, `currency`
- **AddToCart** — `src/contexts/CartContext.tsx`: fire in `addToCart` callback with product details
- **InitiateCheckout** — `src/pages/CheckoutPage.tsx`: fire on mount with cart value and items
- **Purchase** — `src/pages/CheckoutPage.tsx`: fire after successful order placement with order value and currency

For AddToCart, the hook needs to be accessible outside React components, so the pixel helper will also be exported as standalone functions that check for `window.fbq`.

### Files Changed
1. **Migration** — add `facebook_pixel_id` column
2. **`src/hooks/useFacebookPixel.ts`** — new file, pixel injection + event helpers
3. **`src/pages/StoreSettings.tsx`** — add pixel ID input + save
4. **`src/layouts/StorefrontLayout.tsx`** — call useFacebookPixel
5. **`src/pages/ProductDetail.tsx`** — track ViewContent
6. **`src/contexts/CartContext.tsx`** — track AddToCart
7. **`src/pages/CheckoutPage.tsx`** — track InitiateCheckout + Purchase

