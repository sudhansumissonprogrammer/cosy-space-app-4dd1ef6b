# Project architecture decisions

- Use a service-role-only database aggregate for the WhatsApp recipient tier check, because transferring up to 20,000 message rows per send burdens the shared sender.
- Storefront saved-address writes use `replace_customer_address`, because a shopper has at most one current address and plain inserts violate its unique index.
- Meesho imports use a local Manifest V3 collector plus an authenticated one-product-at-a-time import function, because Meesho blocks cloud scraping and ShopBanao secrets must never enter the extension.
- Product photos use `processProductPhoto` (1200px ceiling, WebP q0.94→0.86, ~150KB target) instead of the generic 120KB pipeline, because storefront detail photos must keep fine texture even when that leaves a file slightly above target.

