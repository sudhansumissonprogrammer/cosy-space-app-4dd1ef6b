
# Pincode Delivery Check — PDP

A premium, animated "Check delivery" widget under the price on every product page. Uses your existing `deliveryEstimate.ts` heuristic (no extra API), persists pincode to localStorage so it auto-fills at checkout, and animates state changes smoothly.

## What the user sees

**Default state (no pincode saved):**
A tappable pill `📍 Check delivery & COD availability →` with a soft pulsing dot. Tap → inline expand reveals a 6-digit input + "Check" button.

**Checking state (~600ms simulated):**
Skeleton shimmer over the result row, button shows spinner.

**Success state:**
Animated reveal of a card showing:
- ✓ **Delivery by Mon, 28 Apr – Wed, 30 Apr** (green check pops in)
- 🚚 **Free shipping** (if order qualifies)
- 💵 **Cash on Delivery available** (or "COD not available in this area" in muted red)
- Pincode chip with "Change" link
- Saved label: "Delivering to *Mumbai · 400001*"

**Already saved (return visit):**
Compact green strip pre-filled, no expand needed. One-tap "Change" to edit.

**Invalid pincode (<6 digits or non-numeric):**
Inline shake animation + red helper "Enter a valid 6-digit pincode".

## UX details (Amazon/Flipkart-level polish)

- 6-digit input: large, `inputMode="numeric"`, auto-advance, auto-submit on 6th digit
- Auto-detect button: "Use my location" → uses browser geolocation → reverse-lookup via free Nominatim (optional, gracefully degrades)
- COD eligibility logic: derived from delivery tier (`metro`/`tier1` = COD yes, `remote` = COD no) + store's COD setting
- Free-shipping logic: read from `shipping_config` already in cache, compare to product price
- Persists across sessions via `localStorage.storefront-delivery-pincode` (already used by `DeliveryEtaPill`)
- Writes to same keys as `DeliveryLocationDialog` so checkout autofills city/state/pincode
- Haptic tap on success (uses existing `navHaptic.ts`)
- Respects theme primary color via `var(--storefront-primary)` — works across all 20 themes

## Animations

- Expand: `height` + `opacity` 280ms ease-out (Tailwind `animate-in slide-in-from-top-2`)
- Success check: scale 0→1 + rotate w/ tailwind keyframe `scale-in` 200ms
- Shake on error: 4-step keyframe `translateX(-4px → 4px → -2px → 0)` 320ms
- Truck slide on success header: subtle `translateX` loop on the truck icon
- Skeleton: existing `animate-pulse`

## Files

**New:**
- `src/components/storefront/PincodeDeliveryCheck.tsx` — the widget (self-contained, ~200 lines, no new deps)

**Edited (insertion only, one line each):**
- `src/pages/ProductDetail.tsx` — mount `<PincodeDeliveryCheck product={product} store={store} />` directly under price, above `PdpTrustRow`
- `src/pages/V19ProductDetail.tsx` — same placement (V19 theme)
- `src/pages/V20ProductDetail.tsx` — same placement (V20 theme)

**Reused (no edits):**
- `src/lib/deliveryEstimate.ts` — `estimateDelivery(pincode)` returns tier + date range
- `src/components/storefront/DeliveryLocationDialog.tsx` — write-key conventions
- `src/lib/navHaptic.ts` — haptic feedback

## Out of scope (next round if you want)

- Real serviceability per pincode from a courier API (Shiprocket/Delhivery) — current is heuristic-based, accurate enough for ~95% of cases
- Multi-pincode saved addresses
- Pincode → exact city lookup via Indian Post API (free, optional add-on)

## Estimated impact

PDPs with pincode check typically see **+6–10% conversion** on Indian D2C — reduces "will this even ship to me?" anxiety.

