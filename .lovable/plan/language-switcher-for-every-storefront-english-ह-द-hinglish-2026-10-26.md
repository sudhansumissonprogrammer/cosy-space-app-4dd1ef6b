# Language switcher for every storefront (English / हिंदी / Hinglish)

## What shoppers will see

- A slim strip at the very top of every store (all current and future stores, all themes): "🌐 English | हिंदी | Hinglish".
- On first visit, a small gentle animation (soft glow/pulse on the strip, plays once for ~3 seconds) so people notice it. Never a popup, never mandatory. Choice is remembered on that phone.
- Default stays English exactly as today.

## What gets translated

- Everything on the store: buttons, menus, cart, checkout, policies, banners, category names, product descriptions, reviews text, delivery messages.
- Stays the same in every language:
  - Product names (titles) — always English.
  - All numbers: prices, ₹ amounts, phone numbers, pincodes, order IDs, quantities, dates as digits.
  - Brand names, store name, coupon codes, email/links.
- Hindi = proper Devanagari Hindi. Hinglish = Hindi written in English letters (e.g. "Cart mein add karein").

## How it works (plain)

- When a shopper picks Hindi or Hinglish, the page text is translated by AI once and saved, so the next shopper gets it instantly with no AI cost.
- New products/descriptions added later are translated automatically the first time someone views them in Hindi/Hinglish.
- English shoppers load nothing extra, so page speed is unchanged for them.
- Checkout, payment and order data are never changed — only what is shown on screen.

## Technical details

- New table `ui_translations` (text hash, language, translated text), public read, writes only via edge function (service role).
- Edge function `translate-texts`: batches up to ~100 strings, cache lookup, misses sent to Lovable AI (gemini flash) with strict rules (keep numbers, ₹, codes, brand names untouched; Hinglish in Latin script), stores results.
- Client `StorefrontTranslator` (lazy-loaded only when language ≠ English): walks visible text nodes + placeholders/aria-labels, skips `.notranslate`/`data-no-translate`, `input`, `script`, number-only strings; MutationObserver for route/dynamic changes; debounced batching; localStorage cache.
- Product title elements across all product-card/PDP themes get `translate="no"` + `notranslate` via shared title components.
- `LanguageStrip` mounted once in the shared storefront shell (above marquee), so every theme and every new store gets it; hidden on admin/dashboard/landing.
- Sets `<html lang>` to hi when Hindi; crawler/SEO output stays English (no change to bot rendering).

## Verification

- Switch languages on a demo store on mobile: titles and prices unchanged, rest translated; reload remembers choice; English path loads no extra code. make sure it wont affect page load anthing do safely it wont affect load