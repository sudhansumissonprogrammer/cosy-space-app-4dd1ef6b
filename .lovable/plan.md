

## Cart System Implementation Plan

### Current State
- Products can be ordered one at a time via **WhatsApp** (order_mode: "whatsapp") or **Website checkout** (order_mode: "website")
- No cart exists — "Add to Cart" button on product cards just links to product detail page
- Checkout page handles single product only via URL params

### What We'll Build

A **client-side cart** (localStorage-based, per-store) that supports multiple items, works with both WhatsApp and website order flows.

### New Files

1. **`src/contexts/CartContext.tsx`** — Cart state management
   - Store cart items in localStorage keyed by store slug
   - Each item: `{ productId, variantId?, name, variantName?, price, image, quantity }`
   - Functions: `addToCart`, `removeFromCart`, `updateQuantity`, `clearCart`, `getCartTotal`, `cartCount`
   - Cart badge count exposed for header

2. **`src/pages/CartPage.tsx`** — Full cart view page
   - List all cart items with image, name, variant, price, quantity controls, remove button
   - Cart summary with subtotal and total
   - Two action buttons based on store's `order_mode`:
     - **Website**: "Proceed to Checkout" → navigates to checkout with cart data
     - **WhatsApp**: "Order on WhatsApp" → opens WhatsApp with all cart items in the message
   - Empty cart state with "Continue Shopping" link

### Modified Files

3. **`src/layouts/StorefrontLayout.tsx`**
   - Wrap `<Outlet>` with `CartProvider`
   - Add cart icon with badge count in the header nav bar

4. **`src/components/storefront/StorefrontProductCard.tsx`**
   - "Add to Cart" button actually adds product to cart (with toast confirmation) instead of linking to product detail

5. **`src/pages/ProductDetail.tsx`**
   - Add "Add to Cart" button alongside existing "Buy Now" / "Order on WhatsApp" buttons
   - Include variant selection in cart item when adding

6. **`src/pages/CheckoutPage.tsx`**
   - Support cart-based checkout (multiple items) in addition to existing single-product mode
   - If no `?product=` param, read items from cart context
   - Show all cart items in order summary
   - On order placement, create one order with multiple order_items
   - Clear cart after successful order

7. **`src/App.tsx`**
   - Add route: `/store/:slug/cart` → `CartPage`

### Cart Flow

```text
Product Card / Product Detail
    ↓ "Add to Cart"
Cart (localStorage, per-store)
    ↓ "Proceed to Checkout" or "Order on WhatsApp"
    ├─ Website: Checkout page (multi-item order)
    └─ WhatsApp: Opens WhatsApp with full cart details
```

### Technical Details
- Cart stored in localStorage as JSON, keyed by `cart_{storeSlug}`
- No database tables needed — cart is ephemeral client-side state
- Cart context wraps storefront routes only
- WhatsApp flow: formats all cart items into a single WhatsApp message with item names, quantities, prices, and total
- Website flow: creates single `orders` row + multiple `order_items` rows + one `customer_leads` entry

