# Blank PDP photo investigation

## Evidence

- Screenshot shows Imitation World Mahakal Third-Eye pendant with a blank main gallery and working similar-design photos in Instagram's browser.
- Public product identified by the selected first similar tile: `trendy-2gram-micro-gold-plated-allure-premium-tradistional-fancy-stylish-new-hin-9jos5a`.
- Live main 1200w source returned a decoded 1086px photo, opacity 1 and no skeleton on initial entry and two reloads. Three mobile touch swipes also showed the photo. No page errors.
- The exact screenshot failure did not reproduce. An Instagram user-agent check is not testing the actual Instagram WebView or the user's connection.
- Confirmed unhandled path: standard/V22 galleries previously treated an image error as loaded, leaving an empty gallery without retry. Smaller thumbnail files succeeding does not prove the independent main-photo request succeeded.

## Change

Shared GalleryImage retries the same existing source once after an error. A second error shows an explicit message and Retry photo. Manual retry remounts that image, readiness remains source-scoped and uses a stable ref, and successful cold entries schedule no additional photo requests. No alternate URLs, variants or recompression added.

## Verification

- 12 GalleryImage/useImageActivation tests pass.
- Preview browser deliberately aborted the main image: recovery control appeared; after restoring network and tapping Retry photo, the pendant visibly painted. Cached reload also passed without a page error.
- Preview build OK.
- Localhost's existing Festival badge asset limitation is unchanged; live badge works.
- Production publication and actual Instagram-device confirmation remain necessary. No orders or payments submitted.- Likely cause found: the standard gallery marked the main photo loaded whenever tap-transition data existed, hiding the placeholder before the new photo downloaded. Removed; cached readiness check covers instant cached display.
