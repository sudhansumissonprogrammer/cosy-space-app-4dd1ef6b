# Roadmap

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
