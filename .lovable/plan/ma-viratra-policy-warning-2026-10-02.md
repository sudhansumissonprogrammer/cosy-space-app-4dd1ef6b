# Ma Viratra policy warning

## Goal
Show a dismissible policy-violation warning only inside the Ma Viratra owner dashboard. The storefront remains online; the notice does not automatically suspend the store.

## Changes
- Add a dashboard popup targeted only to the store slug `maviratraimitation`.
- State that the store violates ShopBanao's product-listing policy and is scheduled for permanent suspension.
- Warn that the website may go down in 5 hours and advise turning off active ads.
- Include a close icon and a prominent link to ShopBanao Terms & Conditions.
- Show the popup again on a future dashboard visit after it is closed, so the warning is not permanently dismissed.

## Safety and scope
- Do not change the store's suspension status or take the storefront offline.
- Do not show the warning to customers or other ShopBanao sellers.
- Verify the dashboard still builds cleanly and that the popup is usable on desktop and mobile.
