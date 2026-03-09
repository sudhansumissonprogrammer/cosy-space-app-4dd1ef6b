

## Plan: Clean Up Product Detail Action Buttons for "Both" Mode

### Problem
Currently, `WhatsAppOrderButton`, `BuyNowButton`, and `AddToCartButton` are three separate components each with their own variant selector. The WhatsApp component also includes a large form (name, phone, coupon). When mode is "both", this creates a cluttered layout where Buy Now is buried below the WhatsApp form.

### Solution
Restructure the product detail page to have:
1. **One shared variant selector** at the top (lifted to parent)
2. **Three clean action buttons** shown together based on order mode
3. **WhatsApp form fields** (name, phone, coupon) shown in a collapsible/dialog only when the user clicks "Order on WhatsApp"

### Changes

**`src/pages/ProductDetail.tsx`** — Major refactor of the action section:

- **Lift variant selection** to the parent (`ProductDetail` component) — single shared `selectedVariant` state
- **Replace the three separate button components** with a unified action section that renders:
  - Variant selector (once, shared)
  - A row of buttons based on `order_mode`:
    - `Add to Cart` (always shown)
    - `Buy Now` (shown for `website` or `both`) — navigates to checkout
    - `Order on WhatsApp` (shown for `whatsapp` or `both`) — opens a dialog/sheet with name, phone, coupon fields, then redirects to WhatsApp
- **WhatsApp dialog**: Move the customer name, phone, and coupon form into a `Dialog` that opens when "Order on WhatsApp" is clicked. The dialog contains the form + confirm button.
- **Remove** the standalone `WhatsAppOrderButton`, `BuyNowButton`, and `AddToCartButton` components — replace with inline rendering + a `WhatsAppOrderDialog` component

### Layout (in the product info column)
```text
[Variant selector - if variants exist]

[Add to Cart]  [Buy Now]  [Order on WhatsApp]
   (always)    (website    (whatsapp
                or both)    or both)
```

Buttons will stack vertically on mobile (`flex-col`) and sit in a row on desktop (`sm:flex-row`).

### Files
| File | Change |
|------|--------|
| `src/pages/ProductDetail.tsx` | Refactor action section: shared variant, 3 buttons in a row, WhatsApp form in dialog |

