# JD Store Spy – Chrome extension for JD WebNShip / JD WebShop / JD WebConnect stores

## What I checked first (public data only)
Every JD store, whether on a subdomain or its own domain, runs the same Next.js storefront and uses one shared public product API. Without logging in, it shows:

- Store profile: name, phone, email, WhatsApp setting, Meta Pixel ID, Google Analytics ID, theme, offer text, retailer vs wholesaler
- Store settings: whether prepaid and payment gateway are on, whether reviews are on, out-of-stock display, maintenance mode
- Categories and subcategories
- Products: name, price, MRP, discount, cover and gallery photos, video, **date added** (`created_at`), in stock yes/no, variations, wholesaler/retailer IDs
- Featured, new-arrival, and recently-added lists

**Not public:** real order counts, sales numbers, customer orders, and exact stock quantities. Order endpoints need the shopper's own login. The extension will **not** try to get around this. "Top selling" and "orders" will be **estimates** from public signals, clearly marked as estimates. This is the same approach Shopify spy tools use.

## How "best seller" is estimated
Each product gets a score from:
1. **Reseller spread**: how many of the ~1,050 known JD stores list the same wholesaler SKU. This is the strongest signal, because resellers copy what sells.
2. **Featured placement**: the owner pins it to the featured list.
3. **Days running**: still listed after N days (based on `created_at`).
4. **Sell-outs**: in stock changing to out of stock and back between daily checks.
5. **Price moves**: discounts going deeper, or prices going up.
6. **Video and photo count**: shows the owner invested in the listing.

Labels: "Likely top seller", "Rising", "Stale", and "New (<7 days)".

## What the extension shows
A floating panel on any JD store (detected automatically, including custom domains):

- **Overview**: store age (oldest product date), total products, categories, products added per week, Pixel/GA IDs, prepaid on/off, contact details
- **Top products**: ranked by estimated score, with days running, price/MRP, discount %, number of resellers, and stock state
- **Product page badge**: on a product page, shows the estimated rank, days live, how many stores also sell it, and the price range across those stores
- **Trends** (for tracked stores): new products, removed products, sell-outs, and price changes per day
- **Export CSV** of the full catalog with scores
- **Store directory**: search the ~1,050 known JD stores from the earlier list and open any of them

## Backend (Lovable Cloud) for trends and reseller spread
- Tables for tracked stores, product snapshots, and a SKU-to-stores index. These are admin-only and readable only by the Super Admin role.
- Daily snapshot function for a **watchlist** (default 50 stores, adjustable), throttled and kept separate from the existing Shridya/fashionshub sync quota so imports are not disrupted.
- A one-time, slow seed of the SKU index across the known store list, spread over several days.
- The extension signs in with the ShopBanao Super Admin account, so only you can use it.

## Delivery
- Load-unpacked Chrome extension ZIP in Files, plus short install steps
- An "Extension" page in Super Admin showing watchlist management and snapshot status

## Technical details
- Manifest V3, content script on `*.jdwebshop.com`, `*.jdwebnship.com`, `*.jdwebconnect.com`, plus a check for any custom domain (`/_next` plus a JD API call in the page, or the `home/shell` response)
- Live data is fetched from the browser through the same public endpoints the store itself calls, so it stays within normal visitor traffic. Concurrency is 2, retries back off after 403/429, and the extension never loops through the full store list.
- Edge function `jd-spy-snapshot` (cron, admin-only tables, GRANTs plus RLS through `has_role(admin)`), and edge function `jd-spy-api` for the extension (JWT required, admin role checked)
- No calls to `/customer/*`, `/auth/*`, checkout, coupon, or order-tracking endpoints, and no attempts to read other shoppers' data
- Record the architecture rule in AGENTS.md
