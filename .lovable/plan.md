# Imitation World — "Gold" → "Gold Plated" cleanup + Owner credit

Scope: Only the store **Imitation World** (custom domain `imitationworld.in`, owner `demosahio@gmail.com`, store id `c3c5dff2-173a-4f4d-90e4-8b1c88c305d9`). No other store is touched.

## 1. Product titles & descriptions

I'll run a single update on `products` (filtered by `store_id`) that does the replacements in this order, case-insensitive but preserving the original capitalization of "Gold":

1. `Gold Forming` → `Gold Plated` (covers titles like *Premium gold forming chain*, *Gold forming indo premium chain*, *Premium gold forming Rolyal chain*, *Premium gold forming chain. 2 design mix*).
2. Standalone `Gold` → `Gold Plated` **only when the next word is not already `Plated`** — so existing "Gold plated" titles stay unchanged and we don't end up with "Gold Plated Plated".

### Edge cases — proposed handling

These three titles contain "gold" but the literal swap doesn't read well. My plan, unless you say otherwise in the next reply:

| Current name | After change | Why |
|---|---|---|
| `Rose Gold Charm Ring` | **left as-is** | "Rose Gold" is a color name, not a metal claim — changing it to "Rose Gold Plated Charm Ring" would actually be fine, but most stores keep "Rose Gold" as the color. |
| `Royal Chain men's Gold polish` | **left as-is** | This is a *polish product for gold jewellery*, not a gold item itself. |
| `Royal Chain mens Gold polish 5 year guarentee` | **left as-is** | Same reason. |

If you want me to also rewrite these three to "Gold Plated", reply "yes change polish + rose gold too" and I'll widen the rule. Otherwise I'll skip them.

Descriptions: same two rules applied to the `description` column (7 rows currently contain "gold" without "plated").

## 2. About Us & Contact Us pages

Both pages exist in `store_pages` for this store:

- About Us (`page_type='about'`, slug `about-us`)
- Contact Us (`page_type='contact'`, slug `contact`)

I will append a clearly-formatted owner line to each page's `content` (idempotent — only added if not already present):

```
Owner: Sudhansu Sahoo
```

About Us → added at the end as a new paragraph.
Contact Us → added under the existing "Contact us :-" block so it shows next to email / phone / address.

No code/UI changes — both pages render `content` from the DB, so the storefront will pick it up immediately after the data update.

## 3. What I will NOT touch

- Other stores (only `store_id = c3c5dff2-…c305d9`).
- Categories, product images, prices, stock.
- The Imitation World theme, layout, or any code files.
- Already-correct titles like "Gold plated indo chain".

## Technical notes

- Single `UPDATE` on `products` using `regexp_replace(name, '(?i)gold forming', 'Gold Plated', 'g')` then `regexp_replace(name, '(?i)gold(?!\s*plated)', 'Gold Plated', 'g')`, same for `description`. Scoped by `store_id`.
- Two `UPDATE`s on `store_pages` (about + contact) guarded by `content NOT ILIKE '%Sudhansu Sahoo%'` so re-running is safe.
- All changes go through the data-insert tool (no schema migration needed).

Reply **"go"** to apply, or tell me to widen/narrow the rules (especially the Rose Gold / Gold polish edge cases) first.
