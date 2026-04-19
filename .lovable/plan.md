
The user wants Theme V19 to feel more like real Blinkit. Current state has the right structural pieces (green header, yellow marquee, ADD stepper, 4-tab nav) but lacks Blinkit's signature density, motion, and flow polish. Let me identify the key gaps vs real Blinkit and propose a tight upgrade.

## Blinkit signature elements we're missing

Based on real Blinkit analysis:

1. **Header** — Blinkit shows "Delivery in 8 minutes" big & bold + address line below. WhatsApp icon is not Blinkit-native (replace with profile/cart icons).
2. **Search bar** — Blinkit has a *rotating placeholder* ("Search 'milk'" → "Search 'bread'" → "Search 'eggs'") with typewriter effect.
3. **Promo banners** — Blinkit uses a *swipeable carousel* of large colorful banners, not a single static yellow tile.
4. **Categories** — Blinkit uses **circular product images on colored pastel backgrounds** (not yellow squares with green labels). 4 cols mobile, label below circle.
5. **Product cards** — Blinkit shows a **delivery time badge** ("⏱ 11 MINS") on every card, weight/qty under name ("500 g"), and the ADD button is *outlined green* (not solid), morphing to solid green stepper.
6. **Section headers** — Blinkit doesn't use green gradient bands. It's plain bold black text with "see all →" right-aligned. Below it: horizontal product scroll.
7. **Sticky category rail** — Blinkit has a horizontal scrollable category chip rail that sticks below header on scroll.
8. **Cart FAB** — Blinkit shows a fixed bottom green bar "View Cart · 3 items · ₹240 →" instead of bottom nav cart tab.
9. **Animations** — Add-to-cart has a subtle scale bounce; stepper +/- has haptic-style press feedback.

## Plan — V19 Blinkit refinement (single iteration)

### Files to modify (5 files, no new files)

**1. `src/components/storefront/v19/V19Header.tsx`**
- Replace "Set delivery location" with two-line:
  - Line 1 (bold, 18px): "Delivery in 11 minutes"
  - Line 2 (12px, opacity 80): "HOME · {store name or address} ▼"
- Replace WhatsApp icon with circular avatar/profile icon (User from lucide)
- Search bar: animated rotating placeholder using local state + interval (cycles through ["milk", "bread", "eggs", "atta", "cold drinks"])
- Keep yellow marquee but make it taller and bolder

**2. `src/pages/StorefrontHomeV19.tsx`**
- **Promo carousel**: Replace single yellow tile with a horizontal-scroll banner row (3 colored banners — yellow, pink, mint) using store banner_url + 2 generated gradient cards. Snap-x scroll.
- **Categories**: Switch from yellow squares to **circular images on pastel backgrounds** (4 cols, rotating pastel colors: #FFF1D6, #FFE5E5, #DDEBFF, #E5F7E5, #FFE7F3, #F0E5FF). Round image top, name below circle in dark text.
- **Section headers**: Drop the green gradient band. Use plain `text-[18px] font-black text-gray-900` with "see all →" right-aligned in primary green.
- Add a "Buy again" / "Recently viewed" horizontal scroll if products available.
- Keep horizontal product scroll per category but tighten card width to 42% (Blinkit shows ~2.3 cards visible).

**3. `src/components/storefront/v19/V19ProductCard.tsx`**
- Add **delivery badge** at top-left of image: white pill with green clock icon + "11 MINS" (Blinkit signature)
- Add **weight/qty line** under name: small gray text (use product.weight or fallback "1 piece")
- Change ADD button from solid green → **outlined green** (`border-2 border-[#036B52] text-[#036B52] bg-white`)
- Stepper stays solid green (morph effect already correct)
- Add subtle scale animation on ADD click (`active:scale-95 transition-transform`)
- Discount badge: move to top-left corner *above* delivery badge, use Blinkit purple `#0C831F` style or keep blue

**4. `src/layouts/StorefrontLayoutV19.tsx`**
- Update CSS:
  - Remove `.v19-section-header` green gradient (replace with plain section title rule)
  - Add `.v19-cat-circle` circular pastel category style
  - Add `.v19-promo-card` for swipeable banner cards
  - Add `.v19-delivery-badge` for product card time pill
  - Add `.v19-add-btn-outline` (replace solid)
  - Add `.v19-cart-fab` for sticky "View Cart" bottom bar
  - Keep yellow marquee, beef up font weight

**5. `src/components/storefront/v19/V19BottomNav.tsx`**
- Add a **floating "View Cart" bar** above the bottom nav when cart has items: shows "{count} items · ₹{total}" + arrow → links to /cart
- Bar is full-width, green (#036B52), 44px tall, sits above bottom nav with shadow
- Hide it on /cart and /checkout routes

### Visual reference (ASCII)

```text
┌─────────────────────────────┐
│ Delivery in 11 minutes  (👤)│  ← Header dark green
│ HOME · Stylebazaar       ▼  │
│ ┌─────────────────────────┐ │
│ │🔍 Search "milk"         │ │  ← rotating placeholder
│ └─────────────────────────┘ │
│ ✦ Free delivery on orders   │  ← yellow marquee
├─────────────────────────────┤
│ [yellow banner][pink][mint] │  ← swipeable promo
│                             │
│ ⓪ ⓪ ⓪ ⓪                    │  ← circular pastel cats
│ Dairy Snacks Fruits Drinks  │
│                             │
│ Dairy & Bread      see all →│
│ ┌────┐ ┌────┐ ┌────┐        │  ← horiz scroll cards
│ │11m │ │11m │ │11m │        │  ← delivery badge
│ │ img│ │ img│ │ img│        │
│ │name│ │name│ │name│        │
│ │500g│ │1L  │ │250g│        │
│ │₹40 │ │₹60 │ │₹35 │        │
│ │[ADD│ │[-1+│ │[ADD│        │  ← outlined ADD
│ └────┘ └────┘ └────┘        │
│                             │
├─────────────────────────────┤
│ 🛒 3 items · ₹240        →  │  ← floating cart FAB
├─────────────────────────────┤
│ Home  Cats  Cart  Account   │  ← bottom nav
└─────────────────────────────┘
```

### Out of scope (intentionally)
- Live GPS / address picker (user said visual clone only)
- Real "delivery in X mins" calculation (hardcode 11 MINS as Blinkit-style placeholder)
- Product detail page redesign — only home + cards in this round (can do next round)

### Risks
- Rotating search placeholder uses `setInterval` — must clean up on unmount
- Floating cart FAB needs to coordinate with bottom nav z-index and not overlap product content (add 130px bottom padding when cart has items)
