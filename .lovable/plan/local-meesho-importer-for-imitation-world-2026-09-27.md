# Local Meesho importer for Imitation World

## What will be built
- A Chrome extension that reads a Meesho product only after you open it normally in your own browser. It will collect the real name, current price, original price, description, photos, video when available, product code, and a clean supplier link without tracking parameters.
- A saved-product list inside the extension so you can collect all links one by one, detect duplicates, see missing details, and export one ShopBanao import file.
- A dashboard import screen that accepts that file, shows a final review, and imports the approved products into Imitation World under **New2**.
- A download button and clear Chrome installation steps for the finished extension.

## Safety and quality
- Never guess missing names, prices, descriptions, or media. Products with required details missing will stay blocked for review.
- Accept only Meesho product links, strip UTM/share tracking, sanitize imported text, limit file and batch sizes, and prevent duplicate supplier products.
- Require the normal ShopBanao seller login and verify store ownership before any category or product is created. No private key will be stored in the extension.
- Copy imported photos and available videos to ShopBanao storage before publishing, so products do not depend on Meesho image links or slow the storefront.

## Import behavior
- Create or reuse the **New2** category only when at least one valid product is ready.
- Preserve the original Meesho page as the supplier link and mark the supplier as Meesho.
- Import each product once, attach its gallery in the same order, keep incomplete products out, and report created, skipped, and failed items clearly.
- Verify extraction on the supplied Meesho page, test duplicate and missing-data cases, verify the New2 category and product pages, and package the extension as a ZIP.

## Technical details
- Manifest V3 extension with a content script restricted to `https://www.meesho.com/*`; extraction will prefer structured page data and fall back to visible page fields.
- The extension exports a versioned JSON file. The logged-in dashboard sends validated rows to an authenticated import function, which verifies ownership, mirrors media, creates products and gallery rows, and uses the existing cache-refresh path.
- The backend import is intentionally separated from the extension so browser credentials and backend secrets never leave ShopBanao.
