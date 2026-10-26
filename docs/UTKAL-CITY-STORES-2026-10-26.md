# Utkal Watches — 20-City Store Directory & Local Landing Pages

Date: 2026-10-26. Scope: utkalwatch.in (store_id ab19143d-87a9-490e-90b7-837313522782).

## 1. Audit findings → resolution

| Issue | Evidence | Affected | Priority | Fix |
|---|---|---|---|---|
| No location/city pages existed | No `/stores` route in App.tsx; no location table | All stores | High | Built `store_locations` table + `/stores` + `/stores/:city` |
| Crawlers had no city HTML | Worker `getBotRoute` had no stores kinds | Bots/AI | High | Added `stores` + `city` kinds to Worker + bot-render |
| City pages absent from sitemap | handleSitemap had no locations source | Sitemap | High | Published locations now emitted |
| No internal nav to locations | Footer had no store link | All pages | Medium | "Find a Store" link (shown only when locations exist) |
| llms.txt lacked locations | handleLlms | AI discovery | Low | Locations section added |

Preserved: checkout, payments, orders, product identities, all existing URLs, existing SEO output (verified before editing). No prices or commercial policies changed.

## 2. Architecture

- `/` national homepage — unchanged.
- `/stores` — directory (ItemList + BreadcrumbList schema).
- `/stores/{city}` — one page per city; Bengaluru page naturally mentions "Bangalore" (no duplicate route).
- Data: `public.store_locations` (RLS: anon reads published only; owner manages own; service_role full). Drafts (`is_published=false`) are invisible publicly, excluded from sitemap, and 404 for bots.
- Shared content contract: `supabase/functions/_shared/storeLocations.ts` (re-exported via `src/lib/storeLocations.ts`) — app and bot-render emit identical titles/intros/FAQ.
- Utkal-specific replica phrasing is gated by `isUtkalContentStore`; other stores get neutral wording, so the system works for future stores.

## 3. 20-city table

| City | URL | Status | Keyword cluster | Title | Local usefulness | Validation | Missing facts |
|---|---|---|---|---|---|---|---|
| Rajkot | /stores/rajkot | Published (main store) | first copy watches in Rajkot, watch shop Rajkot | First Copy & Replica Watches in Rajkot \| Utkal Watches | Verified address, hours, WhatsApp, directions | Browser + bot HTML ✓ | PIN code, photos, walk-in/pickup confirmation |
| Mumbai | /stores/mumbai | Published (delivery) | first copy watches in Mumbai | First Copy & Replica Watches in Mumbai \| Utkal Watches | Real catalogue, COD, Rajkot dispatch, WhatsApp | Browser + bot HTML ✓ | Branch address/hours/photos if a branch exists |
| Delhi | /stores/delhi | Published (delivery) | same pattern | same pattern | same | Bot HTML ✓ | same |
| Bengaluru | /stores/bengaluru | Published (delivery) | incl. "Bangalore" | same | same | Bot HTML ✓ | same |
| Hyderabad, Chennai, Kolkata, Pune, Ahmedabad, Surat, Jaipur, Lucknow, Kanpur, Nagpur, Indore, Bhopal, Chandigarh, Patna, Vadodara, Bhubaneswar | /stores/{slug} | Published (delivery) | same pattern | same pattern | same | Sitemap + template ✓ | same |

All 20 rows seeded 2026-10-26 with `content_verified_at = now()`. Only owner-verified facts were seeded: Rajkot main store (Sant Kabir Main Rd, Rajkot, Gujarat; 10 AM–7 PM daily; WhatsApp 7978394101), India-wide online delivery with COD, central dispatch from Rajkot, replica disclosure. Nothing else was invented.

## 4. Before / after

- Before: `https://utkalwatch.in/stores/mumbai` → catch-all NotFound. After: full city shopping page (H1, intro, delivery info, 12 products, FAQ, related links), canonical + sitemap entry.
- Before: bots got the SPA shell on any `/stores/*` path. After: bot-render returns static HTML with products, FAQ and (Rajkot only) Store schema.

## 5. Validation results

- 17 new content-contract tests; full suite 288/288 passed; build OK.
- Browser (preview): directory H1 + 20 city links; Mumbai H1/title/canonical + 12 product cards; Rajkot shows address + hours; unknown city → not-found + noindex; zero page errors.
- Edge (live): bot-render `kind=stores` → correct title/canonical; `kind=city&route_slug=mumbai` → correct H1/title/canonical; `rajkot` → Store JSON-LD with verified address; unknown city → 404. Sitemap part 1 contains `/stores` + city URLs.

## 6. Duplicates / competing pages

None found. One Bengaluru page covers "Bangalore". No city domains/subdomains created. Product URLs unchanged — city pages link to canonical PDPs.

## 7. Remaining owner-data requirements

1. Confirm whether physical branches actually exist in the other 19 cities. If yes, provide per branch: full address + PIN, hours, phone/WhatsApp, photos, walk-in/pickup availability → I will upgrade those pages to `branch` with Store schema.
2. Rajkot: PIN code, store photos, pickup/walk-in confirmation.
3. Google Business Profiles: if branches have GBPs, share them for URL mapping (not done — no profiles provided).

## 8. Remaining deployment/verification steps

1. **Worker deploy (manual, owner)**: `docs/cloudflare-worker-current.js` now routes `/stores` + `/stores/:city` to bot-render. Until deployed, bots get the SPA shell on these routes (Googlebot's JS pass still renders; AI crawlers don't).
2. **Frontend publish**: publish the app so `/stores` routes ship to the live site.
3. **Search Console**: not connected — submit sitemap after publish; monitor city-page indexing/queries.

## 9. Measurement plan (30/60/90)

- 30d: publish + Worker deploy + GSC sitemap submit; verify all 20 city URLs indexed (site: checks / GSC Pages report).
- 60d: review GSC queries per city page; strengthen intros for cities with impressions but low CTR; add owner-supplied branch facts.
- 90d: evaluate "first copy watches in {city}" impressions/clicks trend; decide per-city content expansion only where demand is proven. No ranking position is promised or implied.
