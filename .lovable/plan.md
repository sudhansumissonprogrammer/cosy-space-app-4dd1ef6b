

## Subdomain-Based Store Routing for `storivo.in`

### How It Works

When someone visits `trendymart-india.storivo.in`, the app detects the subdomain, looks up the store by slug, and renders that store's storefront directly -- no `/store/slug` path needed.

### Changes Required

**1. Create a subdomain detection utility (`src/lib/subdomain.ts`)**
- Extract subdomain from `window.location.hostname`
- Define the root domain (`storivo.in`) as a constant
- Return `null` if on root domain, `www`, preview URL, or localhost
- Return the subdomain string (store slug) otherwise

**2. Update `App.tsx` -- AppRouter component**
- At the top of `AppRouter`, call the subdomain utility
- If a subdomain is detected, render `StorefrontLayout` with the subdomain as the slug (instead of reading from URL params)
- Path-based `/store/:slug` routing continues to work as fallback

**3. Update `StorefrontLayout.tsx` -- `useStorefront` hook**
- Accept an optional `slugOverride` prop/parameter
- When provided, use it instead of `useParams().slug`
- This allows both subdomain-based and path-based routing to share the same layout

**4. Update `StoreDomain.tsx` -- Show subdomain URL**
- Replace the misleading "Connect Custom Domain" + DNS instructions with the store's actual subdomain URL: `{slug}.storivo.in`
- Show a copy button for the subdomain URL
- Keep the current path-based URL as a secondary/fallback link

### Technical Details

```text
User visits: trendymart-india.storivo.in
                    │
        ┌───────────┴──────────┐
        │  subdomain.ts        │
        │  extracts:           │
        │  "trendymart-india"  │
        └───────────┬──────────┘
                    │
        ┌───────────┴──────────┐
        │  AppRouter           │
        │  renders:            │
        │  <StorefrontLayout   │
        │    slugOverride=     │
        │    "trendymart-india"│
        │  />                  │
        └──────────────────────┘
```

The root domain `storivo.in` and `www.storivo.in` will continue to load the dashboard/login as normal. Only subdomains like `*.storivo.in` trigger storefront rendering.

### Prerequisites
- Wildcard DNS `*.storivo.in` A record pointing to `185.158.133.1` must be configured at your registrar
- The root `storivo.in` domain is already connected to Lovable

