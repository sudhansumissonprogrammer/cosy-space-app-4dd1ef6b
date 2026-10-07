# Remaining Lighthouse warnings

## Confirmed cause

Live Imitation World homepage now has the corrected loader (no `injected<6`). However, category collage pieces rendered at about 69 CSS pixels still fetch existing 800px/raw files. The uploaded report's 112.9 KiB example belongs to this path, not a duplicate main PDP preload.

## Changes

- Created 39 independent WebP small-display copies, maximum 320px, from verified existing category and curated Similar designs sources. Downloaded originals totalled 4,471,043 bytes; separate copies total 570,886 bytes (about 87% smaller for this bounded set). This is an asset comparison, not a per-page transfer or Lighthouse score claim.
- Explicit source-to-copy manifest prevents missing sibling guesses. Original imported media, category card photos, main PDP and zoom files are untouched. Unknown sources retain existing behavior; this is not a whole-catalogue backfill.
- Shared resolver selects the copies only for requests at 320px or less, including canonical uploads whose verified card source is mapped. Small srcSet requests cannot override them with a large candidate.
- Homepage route components and V16 layout are no longer explicitly forced into the shared opening chunk. Dominant V1 layout retained to avoid unnecessary layout-loading waterfalls. Production byte/CPU improvements require a published measurement.
- Pixels, CAPI, checkout, prices and customer permissions were not changed.

## Verification

1280×1800 preview browser, 12 seconds after each entry: homepage 30 loaded small copies, category three, PDP seven; no broken small copies or JavaScript page errors; thirteen Similar designs links retained. Selected PDP tile still reuses the main photo. Sixteen targeted tests passed before the final srcSet regression assertion was added; rerun recorded in chat verification.

Known pre-existing localhost-only managed badge/trust graphics still fail their relative asset path; these screenshots are not a clean all-graphics pass. Small copies use the public published asset origin, independently checked to serve WebP.

## Not complete

Publication and fresh production Lighthouse/CPU traces are required before claiming the 3-second main-thread or unused-JS/CSS warnings are gone. Remaining stores/catalogue copies, homepage layout attribution and complete shopping/ad-event regressions remain open; nothing was disabled to improve scores.

## Telegram

Fresh workspace connection verified @Shopbanaobot through getMe and redeployed telegram-order-notify. No historic notification replay or test order/message was sent; real order delivery remains unverified.