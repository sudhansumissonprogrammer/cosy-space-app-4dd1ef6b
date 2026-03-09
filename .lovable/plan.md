

## Plan: Simplify Product Card — Only "Add to Cart" Button

### What
Remove "Order on WhatsApp" and "Buy Now" buttons from the product card grid. Keep only the "Add to Cart" button on cards. The full set of 3 buttons (Add to Cart, Buy Now, Order on WhatsApp) remains on the **product detail page** — no changes there.

### Changes

**`src/components/storefront/StorefrontProductCard.tsx`**
- Remove the `showWhatsApp` and `showBuyNow` logic
- Remove the WhatsApp and Buy Now button blocks (lines 136-155)
- Remove unused imports (`MessageCircle`, `ShoppingBag`, `useNavigate`) and unused handlers (`handleWhatsApp`, `handleBuyNow`)
- Keep only the "Add to Cart" button in the action section

The `store` prop can stay since it's passed from parents and may be needed later, but the `order_mode` logic inside the card becomes unused and will be cleaned up.

