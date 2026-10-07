# Current work

- [x] Connect Telegram fresh after the Oct 4 workspace move and redeploy order notifications (COD/PPD label fix already deployed)

- [x] Move parcel-label phone and tracking extraction to the lowest-priced current Gemini vision model.
- [x] Classify all Imitation World New2 products into Chain with Pendant or Pendant from their imported product details.

## Active work
- [x] Reproduce category scroll blanking; add bounded next-row preparation after opening photos/scroll intent, retain activated paint/photos, and verify 33 down/up samples with zero blanks. See docs/CATEGORY-SCROLL-READINESS-2026-10-07.md. Production rollout/LCP/CPU comparison awaits publication; physical-device cross-theme checks remain unverified.
- [x] Verify the Oct 7 20:05 UTC publication on Imitation World: three reported slow-mobile cold runs per page, one desktop run, scroll/touch-swipe/slide/zoom/similar/cart/checkout-opening checks; findings in docs/PUBLISHED-PERFORMANCE-VERIFICATION-2026-10-07.md. Ad delivery and payment completion are unverified; no orders/payments created.
- [ ] Resolve published product/card/cart/checkout title and amount inconsistencies; stabilize homepage/desktop shifts; reduce homepage original-photo activation and opening script/font costs; verify advertising events and authorized payment completion. This audit identified issues but did not change app behavior.
- [x] Connect Telegram fresh after the 19:20 UTC Oct 7 workspace move, verify @Shopbanaobot with getMe, and redeploy telegram-order-notify; no historical messages resent.
- [x] Reproduce remaining Lighthouse small-photo overfetch; create 39 verified separate small copies, preserve originals, check all three preview pages, and exclude homepage/V16 routes from the shared opening chunk.
- [ ] Publication and production browser CPU/cold-entry checks confirmed Oct 7 20:05 audit; fresh Lighthouse unused-JS/CSS attribution and remaining stores/catalogue small-copy coverage still pending. Full performance warning removal is not verified.
- [x] Re-test published homepage/category/PDP (three mobile cold runs, one desktop), isolate six duplicate category downloads, fix opening loader and carousel scheduling, and verify gallery/zoom/similar/cart/checkout opening; report in docs/POST-UPDATE-PERFORMANCE-AUDIT-2026-10-07.md.
- [ ] Live rollout verified after publication; continue existing tiny-photo coverage, homepage/desktop shift fixes, preview badge checks, and cross-store/video/payment/ad-event regressions. Representative touch swipe passes; payment verification needs a safe test flow.
- [x] Connect Telegram fresh after the 18:13 UTC Oct 7 workspace move, verify the bot, and redeploy order alerts.
- [x] Implement first-pass cold-entry deduplication and viewport/gallery activation; verify mobile category, single-photo PDP, Similar designs taps, cart addition, and on-demand zoom.
- [ ] Complete genuine thumbnail derivatives, remaining theme/hover-thumbnail and homepage spacing audits, and full checkout/ad-event regressions; then deploy the updated Worker manually and repeat production cold-entry tests.
- [x] Investigate duplicate category/PDP photo downloads and prepare the complete five-stage image-loading and regression-test plan for approval.
- [x] Enlarge Imitation World similar-design photos, hide gallery thumbnails while keeping swipe, and show the heading on the initial mobile screen.
- [x] Connect Telegram fresh after the 12:52 UTC Oct 7 workspace move, verify the bot, and redeploy order alerts.
- [x] Make Imitation World similar-design taps feel instant with visible-tile preloading and fit more photos in the mobile strip.
- [x] Reconnect Telegram fresh after the 12:23 UTC Oct 7 workspace move and verify order-alert access.
- [x] Add and verify Imitation World’s ordered 13-product similar-photo strip above every PDP title, with current-product selection and deferred loading.
- [x] Reconnect Telegram fresh after the latest Oct 7 workspace move, verify the bot, and redeploy order alerts.
- [x] Reconnect Telegram fresh after the Oct 7 workspace move and verify order-alert access.
- [x] Review every Imitation World Chain with Pendant photo and update only its product name in the requested format.
- [x] Connect Telegram fresh after the 18:27 workspace move, verify the bot, and redeploy order notifications.
- [x] Connect Telegram fresh after the Oct 3 workspace move and redeploy order notifications.
- [x] Add the Festival Sale badge to discounted product-card and PDP-image corners with a lightweight reduced-motion-safe shimmer.
- [x] Remove the merchant-controlled Best Seller badge from every product card and product page, remove all dashboard controls, and clear the feature from every product.
- [x] Add an admin-only `/test-website` capacity planner with staging-only aggressive profiles, production safety locks, request totals, and downloadable Python configuration.
- [ ] Complete the serdiyajewellers.com breaking-point test; passive audit, Python tester, safety locks, and live baseline are complete, but ramp/spike/soak await a production-sized staging URL with real payments and messages disabled.
- [x] Make Serdiya.com open Cashfree in the current page so mobile and in-app browsers cannot block the delayed gateway modal; leave every other store unchanged.
- [x] Generate and append one Gemini/WebP PDP image for the first eight Imitation World Chain with Pendant products after approval of approximate AI results; original images remain unchanged, all eight new images verified as last gallery items and served as WebP.
- [x] Improve product-photo upload quality while aiming for 150 KB, without sacrificing fine detail to force a strict size limit.
- [x] Split new product-photo uploads into lightweight card, sharp PDP, and on-demand high-resolution zoom variants without changing legacy images.
- [ ] Import the supplied Meesho catalogue into Imitation World under `New2` using the new Chrome collector (built, packaged and tested); waiting on the collected export file from your own browser.
- [ ] Import the 14 unique Meesho products into Imitationworld's new `new` category with verified product details and clean supplier links; Meesho denied direct browser, page-reader, and search access to listing details. Supplier editor and link cleaning are implemented; awaiting a reliable product-data source before publishing listings.
- [x] Diagnose the Serdiya Jewellers 48-hour conversion drop across storefront, checkout, payments, and tracking.
- [x] Refine the ShopBanao brand film with larger typography, richer motion design, and a premium Indian female voice; export and verify a new version.
- [x] Rebuild the 30-second ShopBanao film with logo-led motion graphics, minimal store screenshots, and a voiced soundtrack; verify the new export.
- [x] Connect Telegram fresh after the 18:39 workspace move, verify the bot, and redeploy order notifications.
- [x] Import the supplied Blacky and Jewelnex chain products into Imitationworld under a new `new-chains` category, preserving available photos, videos, and product details.
- [x] Connect Telegram fresh after the 13:48 workspace move, verify the bot, and redeploy order notifications.
- [x] Connect Telegram fresh after the 13:43 workspace move, verify the bot, and redeploy order notifications.
- [ ] Audit Imitation World Meta Pixel/CAPI and checkout errors, fix confirmed issues, and verify live behavior.
- [x] Connect Telegram fresh after the latest workspace move, verify the bot, and redeploy order notifications.
- [x] Replace Shakshi Imitation with Shakshi Enterprises throughout that store's footer and About content.
- [x] Restrict product-editing supplier details to Utkal Watch, HopKnock, and CarryBazaar1 only.
- [x] Connect Telegram fresh after the 17:20 workspace move, verify the bot, and redeploy order notifications.
- [x] Audit and fix Serdiya Jewellers abandoned-cart links so valid products open directly and unavailable products safely fall back home.
- [x] Connect Telegram fresh after the latest workspace move, verify the bot, and redeploy order notifications.
- [x] Connect Telegram fresh after the latest workspace move and redeploy order notifications.
- [x] Change every public landing-page commission reference and calculator from 3% to 2% without changing store billing.
- [x] Safely remove only truly uncategorized products from serdiya.com and serdiyajewellers.shop, preserving historical orders.
- [x] Connect Telegram fresh after the latest workspace move and redeploy order notifications.
- [x] Normalize checkout font sizing across Ma Viratra and every other store.
- [x] Add URL-first existing-store migration to onboarding, importing public catalog/content first and offering secure private-data connection later.
- [x] Connect Telegram fresh in the current workspace and verify order notifications.
- [x] Add four uploaded Big Hollow Chain products to a new `new-chaina` category for Serdiya Jewellers, followed by all existing chain products.
- [x] Permanently lock canceled orders against every later status or shipment change.
- [x] Connect Telegram fresh in this workspace and verify order notifications.
- [x] Permanently recover existing verified parcel photos and show them immediately inside each shipped/RTO order.
- [x] Fix shipped-order parcel photos being deleted before WhatsApp finishes downloading them.
- [x] Deploy and verify the shipped-photo WhatsApp fix for Serdiyajewellers.shop.
- [x] Connect Telegram fresh in the new workspace and verify order notifications.
- [x] Add shipment-only RTO status requiring parcel photo evidence.
- [x] Ensure status changes never automatically refund payments or the 3% platform fee.
- [x] Add dashboard RTO filter and verify affected order flows.
- [x] Connect Telegram fresh for the new workspace and redeploy its notification function.
- [x] Make RTO available on every order with scan-first evidence when tracking is missing.
- [x] Default new shipment and RTO parcel scans to India Post.
- [x] Guarantee RTO never sends a customer message.
- [x] Connect Telegram fresh for the new workspace and redeploy order notifications.
- [x] Verify parcel labels only by normalized 10-digit customer phone number.
- [x] Replace customer-facing 17TRACK links with prefilled Speed Post Track links.
- [x] Add automatic four-product category collages to every storefront homepage without extra per-category requests.
- [x] Add owner controls to select and order four category display products.
- [x] Validate category collage security, cache refresh, performance, and mobile/desktop rendering.
- [x] Connect Telegram fresh in the current workspace and verify order-notification delivery setup.
- [ ] Create and fully verify a disposable Pashupati URL-import demo store, then remove any test-only data.
- [x] Connect Telegram fresh after the latest workspace move and redeploy order notifications.
- [x] Make each shopper's newly entered checkout address replace the old saved address and reach the dashboard order.
- [x] Keep the Theme 16 header fixed while scrolling so current and newly created stores retain navigation.

- [ ] Copy missing Serdiya Jewellers reviews into serdiya.com in matching display order.
- [ ] Make every product-page review trigger open the shared review popup.
- [ ] Verify review data, storefront behavior, and build health.
- [x] Connect Telegram fresh in the newly moved workspace and verify the bot connection.
- [x] Connect Telegram fresh after the latest workspace move and verify order notifications.
- [x] Audit Sethia Jewellers WhatsApp marketing messages, chats, spend, and 10-hour order attribution.
- [x] Double-check campaign totals and attributed revenue against independent database queries.
- [x] Produce a detailed WhatsApp marketing performance PDF report.

## Current monitoring review
- [x] Audit five recovered Serdiya PayU orders for single commission charges and notification markers; prevent concurrent Pay taps from dropping transaction references and make uncertain attempts non-final.
- [x] Fix saved addresses, image URLs containing commas, legal price copy, and carousel audio.
- [x] Move WhatsApp unique-recipient counting into the database and deploy the sending service; monitor whether intermittent server failures recur.
- [ ] Restore customer email delivery — blocked until notify.shopbanao.in is configured and verified for email in this workspace.
- [ ] Make paid-order Telegram alerts retry safely — requires a durable, idempotent delivery design and a verified Telegram connection.

## Project monitoring fixes
- [x] Verify and fix public product reads
- [x] Verify and fix QR parcel scans
- [x] Verify and fix payment settings access
- [x] Verify and fix repeated category collage images
- [x] Verify and fix legacy shipment RTO flow
- [x] Verify and fix review text overlap
- [x] Verify and fix saved-address fallback
- [x] Speed parcel gallery scan to tracking-number and exact 10-digit phone matching in a 3–5 second target, and show the saved photo in order details
- [x] Connect Telegram fresh in this workspace and redeploy the affected notification function

- [x] Check and explain apparent missing Files panel content; confirm project and store data remain intact.

- [x] Restore missing saved files to the Files panel after refresh did not re-index them.

- [x] WhatsApp-only store-creation agent built (needs live test from a real phone; admin panel + Telegram alert still open)

- [ ] Rehost Imitation World external review photos (judge.me) to R2
- [x] Connect Telegram fresh after the 18:50 workspace move and redeploy order notifications
