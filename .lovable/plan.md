

## Theme-13: Restaurant QR WhatsApp Ordering

### Concept
A restaurant-specific storefront where customers scan a QR code, browse the menu, build a cart, and place orders directly via WhatsApp message. No traditional checkout flow -- the entire order is sent as a formatted WhatsApp message to the restaurant owner.

### Files to Create

**1. `src/layouts/StorefrontLayoutV13.tsx`** -- Restaurant layout
- Simplified header: restaurant logo + name, no search/wishlist/account icons
- No traditional cart sidebar -- instead a sticky bottom "View Order" bar showing item count + total
- WhatsApp-green accent by default (`#25D366`)
- No footer links for policies/shipping (restaurants don't need these)
- Table number input (optional, from URL param `?table=5`)
- Uses `CartProvider` internally for item management but checkout redirects to WhatsApp

**2. `src/pages/StorefrontHomeV13.tsx`** -- Restaurant menu home
- **No hero banner** -- jumps straight to menu
- Top section: Restaurant name, tagline, operating hours badge (if description exists)
- Horizontal scrollable category tabs (Starters, Mains, Drinks, etc.) that scroll to sections
- Menu items displayed as list cards (image left, name + description + price right, +/- quantity buttons)
- "Veg/Non-Veg" indicator dots (green/red) if product tags contain "veg"/"non-veg"
- Sticky bottom bar: "Send Order on WhatsApp (X items - ₹Total)" button
- Tapping the WhatsApp button composes a pre-formatted message:
  ```
  🍽️ New Order from [Store Name]
  📋 Table: 5 (if provided)
  
  1x Butter Chicken - ₹350
  2x Naan - ₹80
  
  💰 Total: ₹510
  ```

### Files to Modify

**3. `src/App.tsx`**
- Add lazy imports for `StorefrontLayoutV13` and `StorefrontHomeV13`
- Add `theme-13` cases in `ThemeAwareStorefront` layout selector and `storefrontChildRoutes`

**4. `src/pages/StoreThemeSettings.tsx`**
- Add theme-13 entry: `{ id: "theme-13", name: "Restaurant QR Menu", description: "WhatsApp-first QR ordering for restaurants & cafés" }`
- Add default theme config and color combinations for theme-13

### Key Design Decisions
- **No checkout page needed** -- order goes directly to WhatsApp as a formatted message
- **Cart lives in-page** -- uses existing `CartContext` but the "Place Order" button opens `wa.me` link
- **Table number** from `?table=X` URL param (embedded in QR code by restaurant)
- **Menu-style layout** -- horizontal category tabs + list view (not grid) optimized for food menus
- **Minimal chrome** -- no wishlist, no account, no search -- just browse and order fast

### Component Architecture
```text
StorefrontLayoutV13
├── RestaurantHeader (logo + name + table badge)
├── Outlet → StorefrontHomeV13
│   ├── CategoryTabs (horizontal scroll)
│   ├── MenuSection (per category)
│   │   └── MenuItemCard (image + name + price + ±buttons)
│   └── WhatsAppOrderBar (sticky bottom)
└── (no footer)
```

