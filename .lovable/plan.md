## Goal

Make tracking Shopify-grade for **all stores**, regardless of whether the merchant adds a CAPI access token. Pixel-only must still work well; Pixel + CAPI must be best-in-class.

---

## How Shopify handles this (mental model)

Shopify Pixel works for every store out-of-the-box (browser-only). When the merchant connects the Conversions API (token), Shopify automatically mirrors every event server-side with shared `event_id` for dedup. Merchants who never add CAPI still get good tracking — just with the usual 30-50% browser-loss on iOS/adblock. Merchants who add CAPI get EMQ 8-9 + recovered loss.

We already match this architecture (Pixel always fires, CAPI fires conditionally based on `meta_access_token`). The gaps below close the remaining quality delta.

---

## Scope (4 changes)

### 1. Surface CAPI status to merchants — "Marketing Health" widget

**Where:** Store dashboard → Settings → Marketing tab (existing page).

**What it shows:** three status pills per store —
- Pixel ID: ✅ set / ⚠ missing
- CAPI Token: ✅ connected / ⚠ pixel-only mode (link → "Add token for +30% ROAS")
- Last server event: timestamp from `meta_capi_events` log table, or "no events yet"

**Why:** today merchants have no idea CAPI is silently skipped. A visible "pixel-only mode" badge with a one-line ROI pitch is the single biggest behavioral lever to get more stores onto CAPI. Shopify does exactly this.

**No forcing** — pixel-only stores keep working. The widget just nudges.

---

### 2. Pixel-only fallback hardening (for stores that never add CAPI)

For every browser event, ensure the Pixel payload alone is rich enough that Meta's EMQ stays ≥6 even without server backup:

- **Purchase** — add `contents[].item_price` and `contents[].quantity` to the browser `fbq("track","Purchase",...)` call in `CheckoutPage.tsx`. Today only `content_ids + value` are sent. Per-line item_price unlocks DPA + better attribution for pixel-only stores.
- **AddPaymentInfo / InitiateCheckout / AddToCart** — already include `contents[]`, verify `item_price` is set on each.
- **`em`/`ph` advanced matching** — when the storefront customer is logged in, pass plaintext email/phone into `fbq("init", pixelId, { em, ph, external_id })` so Meta auto-hashes browser-side. This is the Pixel-only equivalent of CAPI user_data and adds ~1.5 EMQ for free. We already do this server-side; mirror it browser-side for the pixel-only path.

**Result:** stores without CAPI token still get Shopify-grade pixel quality.

### 3. CAPI mirror parity (for stores that DO add token)

When a store has CAPI configured, every browser event must have a matching server event with same `event_id`. Audit + fix any gaps:

- **Purchase** — add `contents[].item_price` to the server payload too (mirror change #2).
- **`fireMetaCAPI`** in `src/lib/metaCapi.ts` — already passes `contents` through; just ensure callers populate `item_price`.

### 4. Reliability: 1-retry on CAPI 5xx

In `supabase/functions/meta-capi/index.ts`, when `metaResponse.status >= 500`, wait 500ms and retry once. 4xx (token bad, schema bad) is not retried — that's a config issue, retrying won't help. Lifts delivery from ~99.5% → ~99.9%.

---

## Out of scope (deliberate)

- **Forcing CAPI onboarding** — keep it opt-in. Pixel-only must stay first-class.
- **`Subscribe` / `CompleteRegistration`** — separate small task.
- **`delivery_category`** on Purchase — minor, separate.
- **Currency validation, custom ViewCategory event** — cosmetic, skip for now.
- **V19/V20 custom checkout AddPaymentInfo** — those use V20CartPage; will need a follow-up pass once the main CheckoutPage flow is verified.

---

## Files touched

```
src/pages/CheckoutPage.tsx           — add item_price to Purchase contents; advanced matching on init
src/contexts/StorefrontAuthContext   — pass em/ph into fbq init when customer logs in
src/lib/metaCapi.ts                  — no logic change, just verify item_price flows through
supabase/functions/meta-capi/index.ts — 1-retry on 5xx
src/pages/StoreSettings.tsx (Marketing tab) — add Marketing Health widget
                                              (Pixel / CAPI / last event status)
```

No DB migrations, no new edge functions, no breaking changes.

---

## Verification after build

1. **Pixel-only store** (imitationworld): Meta Pixel Helper shows Purchase with `contents[{id, quantity, item_price}]`. Events Manager EMQ ≥ 6.
2. **Pixel + CAPI store** (serdiyajewellers, after they paste token): Events Manager → CAPI tab shows matching `event_id`, EMQ ≥ 8, dedup status "Yes".
3. **Marketing Health widget**: shows red dot + "Add CAPI token (+30% ROAS)" for serdiyajewellers; green dots once token is added.
4. CAPI 5xx retry: simulate by temporarily breaking Meta endpoint in a test, confirm second attempt logged.

---

## Order of implementation

1. Marketing Health widget (biggest behavioral lever — gets more stores onto CAPI)
2. `item_price` on Purchase (browser + server)
3. Browser-side advanced matching (`em`/`ph` in fbq init)
4. CAPI 5xx retry

Approve and I'll ship in this order.