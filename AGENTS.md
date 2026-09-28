# Project architecture decisions

- Use a service-role-only database aggregate for the WhatsApp recipient tier check, because transferring up to 20,000 message rows per send burdens the shared sender.
- Storefront saved-address writes use `replace_customer_address`, because a shopper has at most one current address and plain inserts violate its unique index.
- Meesho imports use a local Manifest V3 collector plus an authenticated one-product-at-a-time import function, because Meesho blocks cloud scraping and ShopBanao secrets must never enter the extension.
- New dashboard product-photo uploads create 400w card, 1200w PDP, and 2000w zoom WebP variants from one original decode; the 1200w URL is stored as canonical and legacy 800w URLs never derive nonexistent siblings, because cards must stay fast while jewellery zoom retains detail.

