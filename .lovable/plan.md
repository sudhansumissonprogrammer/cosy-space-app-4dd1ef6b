

## Plan: Rename Return Policy + Add Terms & Privacy Pages

### Changes Overview

**1. Rename Return Policy → "Return, Refund & Cancellation Policy"**
- Update `StorefrontReturnPolicy.tsx`: Change page title and expand content to cover returns, refunds, and cancellation policies with store-specific variables (store name, WhatsApp, location)
- Update footer link label in `StorefrontFooter.tsx`
- Update hamburger menu label in `StorefrontLayout.tsx`

**2. Create Terms & Conditions page** (`src/pages/StorefrontTerms.tsx`)
- Generic legal content covering: acceptance of terms, use of website, intellectual property, limitation of liability, governing law, changes to terms
- Uses store variables: `store.name`, `store.whatsapp_number`, `store.location`, `store.city`, `store.state`

**3. Create Privacy Policy page** (`src/pages/StorefrontPrivacyPolicy.tsx`)
- Generic content covering: information collection, use of data, cookies, third-party sharing, data security, user rights, contact info
- Same store variable pattern

**4. Add routes** in `App.tsx` for both subdomain and path-based storefronts:
- `/terms` → `StorefrontTerms`
- `/privacy-policy` → `StorefrontPrivacyPolicy`

**5. Update navigation**
- `StorefrontFooter.tsx`: Add "Terms & Conditions" and "Privacy Policy" links
- `StorefrontLayout.tsx` hamburger menu: Add both new links, rename return policy link

### Files Modified
- `src/pages/StorefrontReturnPolicy.tsx` — Rename + expand content
- `src/components/storefront/StorefrontFooter.tsx` — Add links, rename return policy
- `src/layouts/StorefrontLayout.tsx` — Update menu labels, add icons
- `src/App.tsx` — Add 2 new routes

### Files Created
- `src/pages/StorefrontTerms.tsx`
- `src/pages/StorefrontPrivacyPolicy.tsx`

