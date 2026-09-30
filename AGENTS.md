# Project architecture decisions

- Use a service-role-only database aggregate for the WhatsApp recipient tier check, because transferring up to 20,000 message rows per send burdens the shared sender.
- Storefront saved-address writes use `replace_customer_address`, because a shopper has at most one current address and plain inserts violate its unique index.
- Meesho imports use a local Manifest V3 collector plus an authenticated one-product-at-a-time import function, because Meesho blocks cloud scraping and ShopBanao secrets must never enter the extension.
- New dashboard product-photo uploads create 800w card, 1200w PDP, and 2000w zoom WebP variants from one original decode; the 1200w URL is stored as canonical and legacy 800w URLs never derive nonexistent siblings, because cards must stay sharp on retina phones while jewellery zoom retains detail.
- Reserve every PayU attempt with a service-role-only row-locked database function and treat unknown attempts as unsettled, because concurrent retries must not lose a paid reference or cancel an unresolved payment.
- Open Cashfree in the current page only for Serdiya.com while retaining the modal elsewhere, because delayed modal launches are blocked by some WhatsApp/Instagram mobile browsers.

