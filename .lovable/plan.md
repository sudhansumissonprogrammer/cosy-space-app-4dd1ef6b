# Partial Payment Trust Card on PDP

## Goal
For stores that have **partial payment enabled**, show a small, trust-building card on every product page that clearly says:
- "Pay only ₹X now to confirm order"
- "Pay remaining ₹Y cash on delivery"
- Why we charge advance (reduce fake orders)
- We send parcel photo on WhatsApp before dispatch

Customer should instantly understand the COD-with-small-advance model → fewer drop-offs at checkout.

## Where it shows
On every PDP, **right under the price + existing trust pills** and **above the Add to Cart button area**. Specifically:

- `src/pages/ProductDetail.tsx` (default + V2/V3/V10–V18) — after the existing `PdpTrustRow` / price block (~line 895 area)
- `src/pages/V19ProductDetail.tsx` — right after `<DeliveryEtaPill />` / `<CouponTeaser />` (line 463)
- `src/pages/V20ProductDetail.tsx` — same spot (line 373)

Only renders when `store.partial_payment_enabled === true` AND `store.partial_payment_value > 0`. Otherwise returns `null` — zero visual impact on stores without partial payment.

## What it looks like (compact, trust-first, not bulky)

```text
┌──────────────────────────────────────────────────────┐
│ 🛡️  Pay ₹100 now · ₹1,700 on delivery                │
│                                                       │
│  ✓ Small advance to confirm your order                │
│  ✓ Rest in cash when parcel reaches you               │
│  📦 Parcel photo sent on WhatsApp before dispatch     │
└──────────────────────────────────────────────────────┘
```

Design specs:
- Single card, ~110–130px tall on mobile, full-width with mx-4 margins (matches existing `DeliveryEtaPill` / `CouponTeaser` rhythm)
- Rounded-xl, soft emerald/green gradient background (trust color), 1px emerald-200 border
- Top row: shield icon + **bold split price** (₹advance NOW · ₹balance ON DELIVERY) — the headline
- 2 short bullet lines with tiny check icons (12px text)
- 1 line: 📦 parcel-photo promise (separator above, slightly muted)
- No CTA button (PDP CTA is already Add to Cart) — this is informational/trust only
- Uses semantic tokens (no hard-coded colors in component logic; emerald-50/100/700 ok as they're tailwind utilities consistent with sibling components like `DeliveryEtaPill`)

## Amount calculation (must match checkout exactly)
Mirror the formula in `src/pages/CheckoutPage.tsx` (lines 486–505) for **single product, qty 1**:

```ts
const price = sale_price && sale_price < price ? sale_price : price;
let advance = store.partial_payment_type === "percentage"
  ? Math.round(price * (store.partial_payment_value / 100))
  : Math.min(store.partial_payment_value, price);
advance = Math.max(advance, 50); // min ₹50 floor (same as checkout)
const balance = Math.max(0, price - advance);
```

We intentionally ignore tax/shipping/coupon on PDP (those are checkout-time). Card shows the per-unit split — clean and honest. If the actual checkout amount differs slightly due to shipping, the checkout screen already breaks it down again.

## Copy (Hindi + English, matches existing bilingual pattern)
- Headline: `Pay ₹{advance} now · ₹{balance} on delivery`
- Bullet 1: `Small advance to confirm your order — protects sellers from fake orders`
- Bullet 2: `Pay the rest in cash when your parcel is delivered`
- Footer line: `📦 We'll send your parcel photo on WhatsApp before dispatch`

(English-first since most storefronts are mixed-audience; can extend to Hindi via existing `tCritical` pattern later if needed — keep scope tight for now.)

## Implementation

**1 new file:** `src/components/storefront/PartialPaymentTrustCard.tsx`
- Props: `{ price: number; salePrice?: number | null; store: { partial_payment_enabled?: boolean; partial_payment_type?: string; partial_payment_value?: number | null }; currencySymbol?: string }`
- Returns `null` if not eligible
- Pure presentational, no data fetching (store data already loaded on PDP)

**3 wiring edits:**
- `src/pages/ProductDetail.tsx` — import + render after the existing checkout trust block (~line 895)
- `src/pages/V19ProductDetail.tsx` — render after `<CouponTeaser />` line 464
- `src/pages/V20ProductDetail.tsx` — render after `<CouponTeaser />` line 374

## Out of scope
- No DB changes (data already exists)
- No checkout changes
- No product-level partial override (currently store-level only — keeps consistency)
- No A/B variant — single trust-first design

## Why this will reduce drop-off
1. **Sticker shock removed early** — buyer sees "only ₹100 now" on PDP, not surprised at checkout
2. **Fake-order reasoning** builds seller credibility (transparent, not greedy)
3. **Parcel-photo promise** is the single biggest COD trust signal in Indian D2C — addresses the #1 fear ("kya sach mein bhejenge?")
4. **Small footprint** — doesn't push price/CTA below fold, keeps PDP scannable
