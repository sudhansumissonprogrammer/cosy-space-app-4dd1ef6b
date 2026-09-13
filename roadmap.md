# Roadmap

- [x] Utkal reviews: separate every photo/video into its own review card and keep product linking optional.
- [x] Reconnect Telegram in the new workspace and redeploy the order-alert function.
- [x] Protect Utkal reviews and uploaded review videos from product-deletion cascades; added owner-only recent-upload recovery access.
- [x] Monitoring cleanup: restore category pagination beyond 50 products, remove the kicked Telegram group, and verify order photos.
- [x] Serdiyajewellers.shop Ring-1: generated and appended one preservation-first 4:5 PDP image to each of the first 10 products.
- [x] Serdiyajewellers.shop Ring-1: audited and appended the same preservation-first 4:5 PDP image treatment to products 11–30; no prior AI creations required reuse.
- [x] PDP gallery reliability: refresh stale gallery data, merge primary + extras in every theme, and purge before prewarming product saves.

## Done
- Utkal Watches: created the Tissot Premium category and linked all 13 active Tissot watches from Sale without removing their Sale assignments
- Store Assistant (dashboard AI help): DB tables, 54-article knowledge base, `dashboard-assistant` edge fn (live model pick, Hinglish retrieval, dashboard map), assistant panel + hook, header/⌘K entry points
- Payment resume fix: per-status bounce in `usePaymentResumeGuard` so a paid order always reaches the confirmation screen
- Shipped cancellation safety: paid shipped/tracked orders can be manually cancelled with commission reversal; new tracking always starts as shipped

## Open
- [x] Checkout loading/buffering glitch: removed address-sync dead taps; bounded payment-settings, transaction creation, and PayU opening; added retry recovery; verified production activity.
- [x] Maviratra Imitation: compressed nine customer-feedback screenshots to WebP and added them as visible store reviews on product pages and checkout.
- [x] Reconnect Telegram in the new workspace and refresh the order-alert function.
- [x] Connect Telegram in the current workspace and redeploy the order-alert function.
- [ ] Authenticated end-to-end test of the assistant panel + new analytics tools (needs a signed-in preview session)
- [ ] Deploy updated `docs/cloudflare-worker-current.js` (domain resolver DB fallback) to Cloudflare
- [x] Deploy Worker mic-permission fix — live now: permissions-policy `microphone=(self)` confirmed on utkalwatch.in, getUserMedia OK
- [x] Store Assistant: short direct answers + per-store business insights (30d orders/revenue/catalog/carts → findings + ranked actions)
- [x] Reconnect Telegram connector in current workspace (multi-group order alerts); `TELEGRAM_API_KEY` available
- [ ] Verify other integrations after workspace move if needed.
