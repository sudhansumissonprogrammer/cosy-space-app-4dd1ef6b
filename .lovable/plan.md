

# Custom HTML Code Feature for Store Pages

## What We're Building

Add a **Custom HTML** toggle to the page editor (About Us, Contact Us, and Custom pages) that lets store owners replace the default page content with their own HTML. The storefront header, mobile nav, and footer remain intact — only the page body becomes custom HTML. An optional **AI Generate** button helps owners create HTML without coding.

## Database Change

Add a `custom_html` column to the `store_pages` table:

```sql
ALTER TABLE public.store_pages ADD COLUMN custom_html text DEFAULT NULL;
```

When `custom_html` is not null/empty, the storefront renders that HTML instead of the default page layout.

## Dashboard: Page Editor Changes (`StorePageEditor.tsx`)

1. Add a **"Use Custom HTML"** toggle switch at the top of the editor
2. When enabled, show:
   - A full-width code editor (monospace `<textarea>`) for raw HTML input
   - An **"AI Generate HTML"** button that calls a backend function to generate page HTML based on a user prompt + store metadata
   - A **Preview** button that opens an iframe preview of the HTML
3. When disabled, show the existing text content editor (current behavior)
4. Save `custom_html` field alongside existing fields

## AI HTML Generation (Backend Function)

Create an edge function `generate-page-html` that:
- Accepts: `{ prompt, storeName, storeDescription, pageType }`
- Uses Lovable AI (Gemini) to generate a complete HTML section
- Returns sanitized HTML (no `<script>` tags for security)
- Examples: landing-style about page, testimonial sections, team profiles, product showcases

## Storefront Rendering Changes

### `StorefrontAboutUs.tsx`
- Check if `store_pages` has `custom_html` for `about_us`
- If present, render via `dangerouslySetInnerHTML` inside a sandboxed container with DOMPurify sanitization
- Otherwise, render existing default content

### `StorefrontContact.tsx`
- Same pattern: fetch `custom_html` from `store_pages` for `contact` type
- If present, render sanitized HTML above or instead of the contact form
- Keep the contact form always visible (it captures leads)

### `StorefrontCustomPage.tsx`
- If `custom_html` exists on the page record, render it instead of plain text content
- Apply DOMPurify sanitization

## Security

- **DOMPurify** sanitization on all rendered HTML (strip `<script>`, `onclick`, etc.)
- HTML is scoped per-store via `store_id` — no cross-store leakage
- Rendered inside a `<div>` with `storefront-custom-html` class for style isolation

## What Store Owners Can Do With Custom HTML

| Capability | Example |
|---|---|
| Custom landing sections | Hero banners, team introductions, brand story with images |
| Embedded content | YouTube videos, Google Maps, Calendly widgets |
| Custom styling | Inline CSS for unique layouts, gradients, animations |
| Testimonials/reviews | Customer quote cards, star ratings |
| FAQ accordions | HTML/CSS-only collapsible sections |
| Image galleries | Grid layouts, before/after comparisons |
| Announcements | Sale banners, event promotions, seasonal content |
| Trust badges | Custom certification logos, partner logos |

## Files to Create/Modify

| File | Change |
|---|---|
| **Migration** | Add `custom_html` column to `store_pages` |
| `supabase/functions/generate-page-html/index.ts` | New edge function for AI HTML generation |
| `src/pages/StorePageEditor.tsx` | Add custom HTML toggle, code editor, AI generate button, preview |
| `src/pages/StorefrontAboutUs.tsx` | Check & render `custom_html` with DOMPurify |
| `src/pages/StorefrontContact.tsx` | Check & render `custom_html` with DOMPurify |
| `src/pages/StorefrontCustomPage.tsx` | Render `custom_html` if present |
| `package.json` | Add `dompurify` + `@types/dompurify` |

