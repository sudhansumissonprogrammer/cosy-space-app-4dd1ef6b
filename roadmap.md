# Roadmap

- [ ] Extend bounded mobile product-card photo readiness across storefront pages/themes; preserve opening speed, desktop and PDP gallery; test scrolling and retained photos.

- [x] COD template cod_order_confirm_v2 APPROVED by Meta and activated.
- [x] COD v3: cod_order_confirm_v3 with product-photo IMAGE header submitted to Meta (PENDING, meta_id 1761198401972969); wa-order-event prefers v3 → v2 → v1; deployed.
- [x] COD change-address flow: corrected address now saved onto the order (street_address + pincode parsed), dashboard shows it, customer re-confirms via buttons; deployed (whatsapp-webhook).
- [x] COD confirmation enabled for Kalinga Jewels only (all other stores OFF); address-step status allowed in database.
- [x] Telegram connected in new workspace (@Shopbanaobot verified, telegram-order-notify redeployed, no history replay).
- [x] COD photo version (v3) approved by Meta and turned on; falls back to text version when an order has no photo.
- [x] Dashboard orders: show COD order confirmed / not confirmed and address confirmed / not confirmed.
- [x] Make WhatsApp replies after Confirm My Order / Confirm Address taps instant.
- [x] Connect Telegram in the newest workspace (verify bot, redeploy telegram-order-notify, no history replay).
- [x] Fix Delhivery customer tracking link (use speedposttrack.io).
- [x] Connect Telegram again in the latest workspace.
- [x] Turned off COD order/address confirmation everywhere (stores_wa_settings.send_cod_confirmation=false); only plain order confirmation sends now
- [x] Reconnected Telegram (std_01m48vsybpez6aqdah0c0gzhpc, @Shopbanaobot verified, telegram-order-notify redeployed)
- [x] Reconnected Telegram in newest workspace (std_01m4b55yqqfepvsddr49egwv7r, @Shopbanaobot verified, telegram-order-notify redeployed, no history replay)

- [x] Third-slide chain poster with 18 exclusions; care last. Kept original 411 KB because lossless re-encoding enlarged it.
- [x] Telegram reconnected, bot verified and order notifications refreshed; no replay.

- [x] Telegram reconnected after 15:54 UTC workspace move; bot verified and notifications refreshed.
- [x] Telegram reconnected in newest workspace (std_01m42nekmzeg7sq6fs03z3vg2p, @Shopbanaobot verified, telegram-order-notify redeployed, no history replay)
- [x] Telegram reconnected after 19:04 UTC move (std_01m46f8xw6em4t91b1652vw1yj)
- [x] Google Ads tracking for all stores: per-store AW-ID + purchase label + optional GTM in dashboard Tracking page, gtag purchase conversion with transaction_id dedup, gclid already on purchase events, existing CSV feed is Google Merchant compatible.
- [x] Telegram reconnected (std_01m483fx66ebmvb70cwrmr7w34, @Shopbanaobot verified via getMe).
- [x] Telegram reconnected after 04:59 UTC move (std_01m27s1bjdf32rgg6tbc20dnqg, @Shopbanaobot verified).
- [ ] Arriving Today WhatsApp message (order_arriving_today_v1, Meta id 1817336819287205): PENDING Meta approval; then send to the order numbers the user provides.
