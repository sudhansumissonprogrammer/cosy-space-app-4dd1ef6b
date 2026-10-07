# Cold-entry photo loading: first-pass verification

## Implemented

- Shared card/image frames withhold image sources until viewport intersection.
- Main PDP galleries assign 1200px sources only to activated slides; later slides activate through gestures/controls.
- PDP intent warmers, transition image, sticky preview, and zoom preview reuse the 1200px main photo.
- Similar designs no longer prepares destination product pages merely because tiles are visible. Current selection reuses the main photo.
- Category navigation prefetch retains code/data, but does not warm four unrelated photos.
- Broad idle route imports are removed; interaction prefetch remains.
- Bootstrap image loading is route-aware and limited. Font display is optional.
- Worker source updates align known uploaded variant families and eliminate hidden image preload grids. This source is not automatically deployed.

## Verified in local preview

Fresh cache-disabled sessions, 390x844 mobile viewport, no initial scrolling, 15 seconds settling:

| Entry | Distinct `/product-images/` URLs | Breakdown |
| --- | --- | --- |
| Chain with Pendant category | 6 | Five 800px files plus one migrated raw photo; zero 1200px or 2000px |
| Tested pendant PDP | 6 | One 1200px main photo and five 800px visible Similar designs photos; zero 2000px |

These are photo-path counts, not every graphic or logo request. The category count includes navigation imagery. The PDP still has large Similar designs files: it does not yet meet the genuine tiny-thumbnail target.

- Scrolling the category activated four additional image URLs.
- Gallery contained one sourced slide on opening.
- All 13 Similar designs links remained present; clicking the first opened the expected Mahakal pendant PDP.
- Zoom requested the 2000px photo only after opening.
- Adding the product opened the cart with the expected product total. No order or payment was created.
- No JavaScript page errors occurred in these checks.
- Fourteen automated tests passed, covering known photo families, activation, curated ordering, and existing test suites.

## Outstanding before complete rollout

- Generate and verify separate small derivatives for Similar designs and category icons/collages. Preserve raw Meesho originals and existing large images.
- Audit remaining hover photos, thumbnail strips, and theme-specific direct card paths. Thumbnail strips in non-Imitation stores still use existing card files.
- Verify placeholder geometry and homepage carousel opening/idle behavior across representative stores.
- Complete multi-photo/video/variant gallery checks across all PDP themes, checkout to payment handoff, and advertising event regressions without placing test production orders.
- Repeat throttled 30–40 second cold entries and LCP/CLS measurements across mobile/desktop, three repetitions each.
- Manually deploy `docs/cloudflare-worker-current.js` to Cloudflare, clear affected HTML caches, and repeat custom-domain cold-entry tests. Old production edge HTML may still preload older URLs until then.

Local badge graphics did not resolve in the captured preview screenshots; verify the managed asset delivery separately before claiming a clean visual check.

This is a first-pass improvement, not a claim that the complete five-stage plan or production rollout has finished.