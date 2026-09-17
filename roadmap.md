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
- [x] Create a creator-style Indian Hinglish UGC handbag advertisement with dynamic product proof, captions, and clear narration.
- [x] Connect Telegram fresh after this workspace move and redeploy the order-alert function.
- [ ] Produce a premium 20-second vertical ShopBanao motion-graphics film using the real logo and platform features.
- [x] PDP opened review panel: load every approved review, show complete text and mobile verified badges, and inherit store theme fonts.
- [x] Replace bulky PDP review sections with the compact checkout-style review strip, neutral styling, and lazy loading.
- [x] Connect Telegram fresh after the latest workspace move and redeploy the order-alert function.
- [x] Fix newly added product variants being saved as sold out and repair affected live variants.
- [x] Connect Telegram fresh in the current workspace and redeploy the order-alert function.
- [x] Review approval and display consistency: 14 on PDP, up to 14 featured reviews, all approved reviews in checkout/review page, featured ordering everywhere.
- [x] Freshly connect Telegram after the latest workspace move and redeploy the order-alert function.
- [x] Checkout loading/buffering glitch: removed address-sync dead taps; bounded payment-settings, transaction creation, and PayU opening; added retry recovery; verified production activity.
- [x] Checkout address integrity: submit the latest customer-entered address only after Continue/payment, show it fully, and repair Serdiya order #8812.
- [x] Maviratra Imitation: compressed nine customer-feedback screenshots to WebP and added them as visible store reviews on product pages and checkout.
- [x] Reconnect Telegram in the new workspace and refresh the order-alert function.
- [x] Connect Telegram in the current workspace and redeploy the order-alert function.
- [ ] Authenticated end-to-end test of the assistant panel + new analytics tools (needs a signed-in preview session)
- [ ] Deploy updated `docs/cloudflare-worker-current.js` (domain resolver DB fallback) to Cloudflare
- [x] Deploy Worker mic-permission fix — live now: permissions-policy `microphone=(self)` confirmed on utkalwatch.in, getUserMedia OK
- [x] Store Assistant: short direct answers + per-store business insights (30d orders/revenue/catalog/carts → findings + ranked actions)
- [x] Reconnect Telegram connector in current workspace (multi-group order alerts); `TELEGRAM_API_KEY` available
- [ ] Verify other integrations after workspace move if needed.
- [x] Preserve customer-entered delivery addresses exactly through checkout/payment retries and show the full saved value in dashboard, without adding stricter validation.
- [x] Serdiya Combo-set mobile shortcuts: compact four-image Chain and Ring cards below filters, loaded before the product grid and hidden everywhere else.
- [x] PDP carousel spacing: disable grid-only off-screen height reservation inside horizontal recommendation rows.
- [x] Serdiya Ring-1 and Chain mobile categories: add a first-position four-image card linking to the opposite category.
- [x] Shopper sign-in reliability: serialize one-time session links, preserve other-device sessions, align stale-lock recovery, and never report success without a session.

- [x] Rebuild ShopBanao product film as a 30-second premium vertical video with real store screens and human voiceover.
- [x] Produce a fully rebuilt high-end 30-second ShopBanao launch film with real product proof, cinematic motion, and clean narration.

- [x] Polish the approved 30-second ShopBanao v3 film without changing its core story or narration.
- [x] Create a second 33-second ShopBanao SaaS explainer inspired by the uploaded cinematic AI-agent reference.
- [x] Connect Telegram fresh for the new workspace and redeploy the affected notification function.
- [x] Create a fully promotional Hindi–English handbag video with voiceover, timed captions, polished effects, and no price.
