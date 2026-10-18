# Kalinga event transmission audit

Evidence collected on 2026-10-18 UTC from the published kalingajewels.com storefront. Store c3c5dff2-173a-4f4d-90e4-8b1c88c305d9; pixel 1379828060800592. This is a read-only audit, not a tracking installation or provider-settings change.

## Observed customer journey

A fresh browser with a standard Chrome user agent opened the OM product, added one INR 699 item, opened checkout and then opened the homepage. No telephone, address, order, payment or customer matching data was submitted. These actions generated test activity, not customer sales.

| Event | Observed destination | Evidence |
| --- | --- | --- |
| PageView | Kalinga product, checkout and homepage URLs | facebook.com/tr HTTP 200, correct pixel |
| ViewContent | Kalinga OM product URL | HTTP 200, INR 699, event ID present |
| AddToCart | Kalinga OM product URL | HTTP 200, INR 699, event ID present |
| InitiateCheckout | https://kalingajewels.com/checkout | HTTP 200, INR 699, event ID present |
| AddPaymentInfo | Not exercised | Source has calls on payment launch; transmission and receipt unverified |
| Purchase | Not exercised | Source has successful-order reporting and durable pending-purchase helper; transmission and receipt unverified |
| Lead | Not observed | No Lead event wired in the active CheckoutV2 flow; internal lead records do not establish a Meta Lead event |

The observed runs had one fbevents.js script and one registered pixel. No browser page errors or console errors were captured. One internal /__l5e/trackevents request aborted during navigation; it was not a failed Meta conversion request. Browser HTTP 200 establishes transmission, not Events Manager receipt, attribution or optimization eligibility.

## Confirmed duplication and external configuration

Checkout emitted two PageView requests with different event IDs in repeated fresh-browser runs: the app event and an ob3_plugin-set_ event. Consequently these requests are not a shared-ID browser/server pair. No duplicated Purchase was tested or established.

Facebook's public configuration for this pixel successfully downloaded. It enables the openbridge3 plugin and configures an external Conversions API gateway at capig.datah04.com, with gateway user-data options enabled. The plugin creates the ob3_plugin-set_ identifier. This is separate from ShopBanao's store-token CAPI sender. Absence of a store token does not establish absence of server reporting elsewhere. Gateway ownership, current health and server receipt remain unknown. Earlier claims that all Kalinga reporting is necessarily browser-only were too broad.

The earlier October 17 audit captured aborted gateway requests and successful facebook.com/tr fallback. This audit confirms the gateway remains in the downloaded configuration; it does not certify that gateway's server events. Do not remove the gateway or change pixel settings without inspecting Events Manager and securing agreement.

## Source audit limits

Additional source behaviors merit focused tests before changes: AddToCart value uses the unit price; product-view suppression and checkout intent dedupe affect repeat actions; Purchase delivery retry needs blocked-SDK/storage tests; the shared Razorpay status path treats authorized payments as confirmed before verified capture. These are investigation leads, not reproduced Kalinga payment failures. No payment state or reporting code was changed.

## Provider checks and next step

Fresh project setup read returned connected=false. Events Manager receipt, allowed website traffic, gateway health, dataset restrictions, registered/custom conversions and campaign optimization settings therefore remain unverified. Public pixel configuration is not a substitute for these authenticated checks.

Connect Meta for read-only verification of this exact pixel and Kalinga domain. Inspect the gateway/automatic page-view setup before changing the duplicate reporting path. Verify AddPaymentInfo and Purchase through a safe test payment path; do not use a real charged or fulfilled order merely to test tracking. A missing app CAPI token is not a reason to replace the working browser pixel or assume no gateway exists.

Evidence files: /tmp/browser/kalinga-events/result.txt, pixel-config.js and screenshots 1_product.png, 2_added.png, 3_checkout.png, 4_home.png. Latest observed harness entry: build OK at 2026-10-18T01:14:03Z; no app-code edits made in this audit.