# Kalinga / Krishna identity and Pixel audit

## Scope and evidence

Read-only inspection of public store, product, category, page, theme, review and trust-video data; source audit of storefront identity gates and browser/server tracking; browser checks of published Kalinga homepage, OM product page, About, Contact and Privacy, and Krishna homepage. No order, payment, message or historical replay was submitted. The cart test generated test PageView, ViewContent and AddToCart activity, not a real sale.

## Kalinga identity

- Permanent store identity still belongs to the former Imitation World store; name, slug and custom domain are Kalinga Jewels / kalingajewels / kalingajewels.com.
- All 359 stored products were checked: zero old brand/domain in public name, description, SEO or image-alt fields; zero 18K claims in those fields. 332 products currently active; visibility was not changed during this audit.
- All 11 category records and both custom page records checked; no old public identity. One category is already hidden. Policies and public contact match the confirmed owner, email, telephone and Patasanipur/Ghiakhala/Khorda address.
- Review, theme and trust-video records contain zero old-brand/domain/telephone references in their stored text. This does not establish the wording inside bitmap/video artwork.
- Corrected saved city Balugaon to Khorda (state Odisha), because the live server-generated SEO keywords still included the obsolete city. Existing address and login identity unchanged.
- Consolidated Meesho/dashboard/category Kalinga gates through the existing helper; a known different store ID now overrides legacy slug fallback. Old product URLs and internal historical filenames deliberately retained.
- Similar Designs and care-slide ordering retained. Live OM PDP renders 16 available designs from the curated 18; the component deliberately omits unavailable products rather than resurrecting them. Existing care artwork and unverified media claims have not been regenerated.
- 19 focused identity/category/rail/care tests pass. Preview PDP renders the OM product and Similar Designs without page errors. Latest harness build OK. Frontend safeguard changes require publication.

## Kalinga Pixel

- Stored browser pixel: 1379828060800592. One SDK script, correctly registered SDK pixel, no page errors.
- Initial headless default browser did not transmit. Repeating with a standard Chrome user-agent transmitted PageView, ViewContent and AddToCart to this pixel, each with a distinct event ID and HTTP 200 response. ViewContent/AddToCart carry INR 699. No Purchase test performed.
- Meta's downloaded pixel configuration includes bot-blocking and a gateway endpoint. Headless suppression is not evidence of a broken customer pixel. Meta Event Setup Tool's screenshot warning was not reproduced inside its authenticated session and its precise cause remains unverified.
- Browser requests to Meta's configured gateway were aborted; fallback facebook.com/tr requests succeeded. Gateway receipt and health are not proven by fallback success.
- Store-side server token is absent and runtime CAPI flag false. Audit history records pixel replacement (917930664598404 to 1379828060800592) and token clearing on September 23, 2026, 13:37:49 UTC, before this rename. Do not restore the previous token/pixel by guessing.
- This workspace has no accessible Meta ads connection. Events Manager receipt, traffic permissions, account/dataset eligibility and attribution remain unverified. Browser HTTP 200 is transmission evidence, not provider reporting proof.

## Krishna Jewels

- Identified existing KrishnaJewelss at krishnajewelss.com.
- No browser pixel ID and no server token saved. Published homepage loads with no Facebook pixel script or initialized pixel. Correct dataset must be supplied/selected; never copy Kalinga's pixel into Krishna.

## Telegram workspace move

Fresh workspace connection linked; getMe verified @Shopbanaobot with HTTP 200; telegram-order-notify redeployed. No message sent or replayed; actual order delivery untested.

## Remaining external steps

1. Select/provide Krishna's correct existing pixel and authorize any server reporting setup.
2. Connect Meta for account-side receipt/domain checks, or verify the selected Kalinga pixel in Events Manager Test Events and inspect traffic permissions for kalingajewels.com.
3. Publish frontend identity safeguards; confirm server-rendered obsolete-city cache refresh.
4. Purchase reporting requires a safe payment test path and provider receipt evidence; it is not certified by a cart test.