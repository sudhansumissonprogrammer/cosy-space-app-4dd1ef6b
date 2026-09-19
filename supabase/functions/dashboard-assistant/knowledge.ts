/**
 * Store Assistant knowledge base.
 *
 * Ground truth for the in-dashboard AI helper. Each article describes ONE task
 * a merchant can do, written from the actual dashboard code. `route` uses
 * `{s}` as a placeholder for `/dashboard/stores/<slug>`.
 *
 * When a dashboard page changes, update its article in the same edit.
 */

export interface HelpArticle {
  id: string;
  title: string;
  route: string;
  keywords: string[];
  body: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "add-product",
    title: "Add a product",
    route: "{s}/products/create",
    keywords: ["add product", "new product", "create product", "item", "price", "photo", "stock", "sku", "variant"],
    body: `1. Open Products → "Add product".
2. Enter the product name, then the selling price and (optional) MRP — the MRP is shown struck-through as the discount.
3. Upload photos. The first photo is the main image shown in the catalog. Square photos look best.
4. Write a short description; you can use the "Generate with AI" button to write it for you.
5. Set stock quantity, and add variants (size/colour) if the product has options.
6. Assign one or more categories so it appears in the storefront menu.
7. Save. The product goes live immediately; use "Purge Cache" in the header if you don't see it right away.`,
  },
  {
    id: "bulk-upload",
    title: "Upload many products at once",
    route: "{s}/products/bulk-upload",
    keywords: ["bulk", "csv", "excel", "import", "mass upload", "supplier", "many products"],
    body: `1. Open Products → Bulk Upload.
2. Download the sample sheet, fill one row per product (name, price, MRP, stock, category, image URLs).
3. Upload the file and review the preview — rows with errors are highlighted.
4. Confirm the import. Large files continue in the background; refresh the Products page to see them.`,
  },
  {
    id: "edit-price-stock",
    title: "Change price or stock",
    route: "{s}/products",
    keywords: ["price", "stock", "out of stock", "inventory", "quick edit", "discount"],
    body: `1. Open Products and find the item (use search).
2. Use the quick-edit action on the row to change price, MRP or stock without opening the full form.
3. To hide a product from the storefront without deleting it, set it inactive/hidden.
4. Out-of-stock products still show but cannot be bought.`,
  },
  {
    id: "categories",
    title: "Create and manage categories",
    route: "{s}/categories",
    keywords: ["category", "collection", "menu", "hide category", "group"],
    body: `1. Open Categories → "Add category". Give it a name and (optionally) an image.
2. Assign products to it from the product form or from the category page.
3. Categories appear in your storefront menu and category pages.
4. Marking a category hidden also hides its products from the storefront.`,
  },
  {
    id: "reviews",
    title: "Product reviews and ratings",
    route: "{s}/reviews",
    keywords: ["review", "rating", "stars", "testimonial", "approve review"],
    body: `1. Open Reviews to see every review customers submitted.
2. Approve, edit or delete a review; approved reviews show on the product page.
3. You can also add reviews yourself (useful for a new store) with a name, rating, text and photo.`,
  },
  {
    id: "orders-manage",
    title: "Confirm, ship and track an order",
    route: "{s}/orders",
    keywords: ["order", "confirm", "ship", "awb", "tracking", "status", "invoice", "delivered"],
    body: `1. Open Orders. Click a row to open the full order details (items, customer, payment, address).
2. Change the status as the order progresses: pending → confirmed → shipped → delivered.
3. To add tracking: open the order, choose the courier, paste the AWB / tracking number and save. The customer can then track it from your store.
4. Order status and shipment status stay in sync — marking a shipment delivered marks the order delivered.
5. Download the invoice from the order details panel.`,
  },
  {
    id: "orders-cancel-refund",
    title: "Cancel an order or refund a customer",
    route: "{s}/orders",
    keywords: ["cancel", "refund", "rto", "return to seller", "money back", "commission refund"],
    body: `1. Open the order and set the status to cancelled.
2. For anything about the platform commission on a cancelled or returned order, contact customer care — they check the order and settle it.
3. Refunding the customer's money is done through your payment provider's dashboard (Razorpay / Cashfree / PayU); the platform does not move that money for you.
4. For COD orders nothing is refunded unless an advance was collected.`,
  },
  {
    id: "pending-orders",
    title: "Why are orders stuck in pending or cancelled?",
    route: "{s}/orders",
    keywords: ["pending", "cancelled", "failed payment", "why", "stuck", "abandoned"],
    body: `A pending order means the customer started checkout but payment was not confirmed yet.
- Orders stay pending for up to 30 minutes while the payment window is open.
- Unpaid pending orders are automatically cancelled after that window — this is normal and does not mean checkout is broken.
- A high cancelled count usually means shoppers are dropping off at the payment step (very common with partial-COD advance payments).
Check Sales Funnel and Abandoned Carts to see where people drop off, and consider lowering the advance amount or offering a prepaid discount.`,
  },
  {
    id: "customers",
    title: "See your customers",
    route: "{s}/customers",
    keywords: ["customer", "buyer", "phone", "repeat", "contact", "export"],
    body: `Open Customers to see everyone who ordered, their phone/email, number of orders and total spent. Click a customer to see their order history. Use this list for WhatsApp follow-ups and repeat-purchase offers.`,
  },
  {
    id: "payments-overview",
    title: "Turn on payment methods",
    route: "{s}/payments",
    keywords: ["payment", "gateway", "enable payment", "how to accept money", "online payment"],
    body: `Open Payments. You can switch on any combination of:
- UPI (direct UPI intent — money comes to your UPI ID)
- Razorpay, Cashfree or PayU (cards, netbanking, UPI, wallets)
- COD (cash on delivery)
- Partial COD (customer pays a small advance online, rest on delivery)
Each method has its own toggle. Save at the bottom, then place a small test order to confirm it works.`,
  },
  {
    id: "razorpay",
    title: "Connect Razorpay",
    route: "{s}/payments",
    keywords: ["razorpay", "key id", "key secret", "webhook", "gateway", "connect razorpay"],
    body: `1. Create/login to your Razorpay account and complete KYC (payments only work once KYC is approved).
2. In Razorpay go to Settings → API Keys → Generate Key. Copy the Key ID and Key Secret.
3. In the dashboard open Payments → Razorpay, turn it on, paste the Key ID and Key Secret and save.
4. Payments are verified automatically by the platform — you do not need to configure a webhook by hand.
5. Place a ₹1 test order to confirm. If payments fail with an authentication error, the key or secret is wrong or the account is in test mode while the store is live.`,
  },
  {
    id: "cashfree",
    title: "Connect Cashfree",
    route: "{s}/payments",
    keywords: ["cashfree", "app id", "secret key", "gateway", "connect cashfree"],
    body: `1. Login to Cashfree → Developers → API Keys and copy the App ID and Secret Key (use Production keys for a live store).
2. In the dashboard open Payments → Cashfree, enable it, paste both values and save.
3. Test with a small order. Failures are almost always production-vs-test key mismatch or incomplete Cashfree KYC.`,
  },
  {
    id: "payu",
    title: "Connect PayU",
    route: "{s}/payments",
    keywords: ["payu", "merchant key", "salt", "gateway", "connect payu"],
    body: `1. Login to PayU → your merchant account and copy the Merchant Key and Salt (v1).
2. In the dashboard open Payments → PayU, enable it, paste the Key and Salt and save.
3. Test with a small order. Payment verification and status checks run automatically.`,
  },
  {
    id: "upi-direct",
    title: "Accept UPI directly",
    route: "{s}/payments",
    keywords: ["upi", "upi id", "vpa", "gpay", "phonepe", "paytm", "qr"],
    body: `1. Open Payments → UPI and enter your UPI ID (e.g. name@okhdfcbank) and the account holder name.
2. Customers get a UPI intent / QR at checkout and pay straight into your account.
3. Because the money reaches you directly, confirm the payment in Orders before shipping.`,
  },
  {
    id: "cod-partial",
    title: "Cash on Delivery and partial COD advance",
    route: "{s}/payments",
    keywords: ["cod", "cash on delivery", "advance", "partial", "token amount", "prepaid discount"],
    body: `1. Open Payments and enable COD.
2. Partial COD asks the customer for a small advance online (fixed amount like ₹100, or a percentage) and the rest in cash on delivery. It cuts fake orders and RTO.
3. Set the advance amount under the partial-payment settings and save.
4. A high advance reduces orders — if many orders are cancelling at the payment step, lower it or offer a prepaid discount instead.`,
  },
  {
    id: "shipping-rates",
    title: "Set delivery charges and free shipping",
    route: "{s}/shipping",
    keywords: ["shipping", "delivery charge", "free shipping", "rate", "zone", "delivery time"],
    body: `1. Open Shipping Rates.
2. Set a flat delivery charge, or free shipping above a cart value (e.g. free above ₹499).
3. Add the estimated delivery time shown on the product and checkout pages.
4. Save — new charges apply to the next order immediately.`,
  },
  {
    id: "courier-partners",
    title: "Connect a courier for automatic tracking",
    route: "{s}/shipping-integrations",
    keywords: ["courier", "delhivery", "blue dart", "ekart", "india post", "awb", "pickup address", "tracking"],
    body: `1. Open Courier Partners and pick your courier (Delhivery, Blue Dart, Ekart and others).
2. Paste the API credentials your courier gave you and save.
3. Add a pickup address — couriers need it to book shipments.
4. Once connected, shipment status updates are fetched automatically and shown to the customer.
Note: India Post is manual-only — you can add the tracking number, but status must be updated by hand because India Post blocks automated tracking.`,
  },
  {
    id: "tax",
    title: "GST and tax settings",
    route: "{s}/tax",
    keywords: ["gst", "tax", "gstin", "hsn", "invoice tax"],
    body: `1. Open Tax / GST.
2. Enter your GSTIN and the default tax rate, and choose whether prices already include tax.
3. Tax is then shown on invoices and the checkout summary.`,
  },
  {
    id: "coupons",
    title: "Create a discount coupon",
    route: "{s}/coupons",
    keywords: ["coupon", "discount", "promo code", "offer", "auto apply", "first order"],
    body: `1. Open Coupons → "Create coupon".
2. Choose a code (e.g. WELCOME10), the type (flat ₹ or %), the discount value and a minimum cart value.
3. Optionally set a usage limit and an expiry date.
4. Turn on auto-apply if you want the discount applied at checkout without the customer typing a code.
5. Save — it works immediately at checkout.`,
  },
  {
    id: "abandoned-carts",
    title: "Recover abandoned carts",
    route: "{s}/abandoned-carts",
    keywords: ["abandoned", "cart recovery", "left without paying", "recover", "whatsapp nudge"],
    body: `1. Open Abandoned Carts to see shoppers who added items and left without paying, with their phone number and cart value.
2. Send a WhatsApp recovery message from the row, or let the automatic recovery flow send it for you.
3. Recovery messages are only sent within the recovery window (about 24 hours) — older carts are skipped.
4. Attach a small coupon to recovery messages for a much better conversion rate.`,
  },
  {
    id: "whatsapp",
    title: "WhatsApp messages and automation",
    route: "{s}/whatsapp",
    keywords: ["whatsapp", "message", "template", "order confirmation", "cod confirm", "broadcast", "campaign"],
    body: `1. Open WhatsApp to control automatic messages: order confirmation, COD confirmation, shipping updates and cart recovery.
2. Turn each automation on or off, and preview the message text.
3. Campaigns let you message a chosen group of customers (e.g. everyone who bought in the last 30 days).
4. Messages go out through the platform's WhatsApp number; customers who opt out are excluded automatically.`,
  },
  {
    id: "tracking-pixels",
    title: "Connect Meta Pixel, CAPI and Google Analytics",
    route: "{s}/tracking",
    keywords: ["pixel", "meta", "facebook", "capi", "conversions api", "google analytics", "ga4", "ads", "conversion"],
    body: `1. Open Tracking Pixels.
2. Paste your Meta Pixel ID to track page views, add-to-cart and purchases for Facebook/Instagram ads.
3. For better ad accuracy also add the Conversions API token — the setup wizard on the page walks you through it.
4. Paste your GA4 Measurement ID for Google Analytics.
5. Save, then open your store and check events are received in Meta Events Manager / GA4 real-time.`,
  },
  {
    id: "theme",
    title: "Change your store design",
    route: "{s}/theme",
    keywords: ["theme", "design", "colour", "color", "font", "layout", "banner", "hero", "look"],
    body: `1. Open Theme & Design.
2. Pick a storefront layout — each one is a complete design, and you can preview before applying.
3. Set brand colours, fonts, and upload your hero/banner images (desktop and mobile).
4. Save and open your store to check. Use "Purge Cache" if the old design is still showing.`,
  },
  {
    id: "pages-policies",
    title: "Edit About Us, Contact and policy pages",
    route: "{s}/pages",
    keywords: ["page", "about us", "contact", "return policy", "refund", "shipping policy", "privacy", "terms"],
    body: `1. Open Pages & Policies.
2. Edit About Us, Contact, Return & Refund, Shipping and Privacy pages. AI can draft any of them for you.
3. These pages are linked in your storefront footer and are required by most payment gateways during KYC.`,
  },
  {
    id: "domain",
    title: "Connect your own domain",
    route: "{s}/domain",
    keywords: ["domain", "custom domain", "dns", "cname", "website address", "godaddy", "namecheap"],
    body: `1. Buy a domain from any registrar (GoDaddy, Namecheap, Hostinger…).
2. Open Domain in the dashboard and enter it (e.g. mystore.in).
3. Add the DNS records shown on that page at your registrar — usually a CNAME for www and the root record given.
4. Come back and press Verify. DNS can take 15 minutes to a few hours to propagate.
5. Once verified, your store is served on your domain with HTTPS automatically.
Until then your store is always live at yourslug.shopbanao.in.`,
  },
  {
    id: "store-settings",
    title: "Store name, logo, address, SEO",
    route: "{s}/settings",
    keywords: ["settings", "store name", "logo", "whatsapp number", "currency", "seo", "meta title", "address", "social"],
    body: `Open Store Settings. It has sections you can jump to:
- Basic: store name, owner name, description, WhatsApp number, owner email, currency, Instagram/Facebook links.
- Location: city, state and full address.
- Media: logo, banner and mobile hero images.
- Display: storefront display options.
- Pages: shortcuts to your policy pages.
- SEO: meta title, meta description and social share image.
- AI: generate store copy automatically.
- Domain: custom domain shortcut.
Changes save from the sticky Save bar at the bottom.`,
  },
  {
    id: "apps",
    title: "App Store add-ons",
    route: "{s}/apps",
    keywords: ["app", "add-on", "shop by video", "bundle", "upsell", "extension", "install app"],
    body: `Open App Store to switch on optional features such as Shop by Video, bundles, upsell/cross-sell and card video. Each app has its own settings page after you enable it. Apps only affect your storefront when enabled.`,
  },
  {
    id: "wallet-billing",
    title: "Wallet, commission and billing",
    route: "{s}/wallet",
    keywords: ["wallet", "balance", "recharge", "commission", "2%", "fee", "billing", "top up", "invoice"],
    body: `1. Open Wallet to see your balance, commission charges and recharge history.
2. Billing is a flat 2% platform commission on every order — there is no monthly subscription.
3. Commission is deducted from the wallet as orders come in, so keep a positive balance or the dashboard will prompt you to recharge.
4. Recharge from the Wallet page; the balance updates as soon as payment is confirmed.
5. For any commission query on a cancelled or returned order, contact customer care.`,
  },
  {
    id: "analytics",
    title: "Understand your analytics",
    route: "/dashboard/analytics",
    keywords: ["analytics", "visitors", "traffic", "revenue", "report", "conversion", "sources"],
    body: `Open Analytics for visitors, revenue, top products, traffic sources and conversion over a chosen date range.
- Sessions = visits, Conversion = orders ÷ sessions.
- Sales Funnel shows drop-off between product view, cart and payment — the fastest way to find what is losing you sales.`,
  },
  {
    id: "share-store",
    title: "Share your store / get the link",
    route: "/dashboard",
    keywords: ["share", "link", "url", "instagram bio", "qr", "promote"],
    body: `Your store link is shown on the Overview page (yourslug.shopbanao.in or your custom domain). Use the copy button, or the Share action in the header for ready-made WhatsApp and Instagram links and a QR code.`,
  },
  {
    id: "cache",
    title: "My change is not showing on the store",
    route: "/dashboard",
    keywords: ["cache", "not showing", "old", "update", "purge", "refresh"],
    body: `Your storefront is served from a global cache for speed. If a change is not visible:
1. Press "Purge Cache" in the dashboard header.
2. Hard-refresh the store page in your browser (Ctrl/Cmd + Shift + R).
Most changes appear within a minute even without purging.`,
  },
  {
    id: "account",
    title: "Login, password and profile",
    route: "/dashboard/settings",
    keywords: ["account", "password", "email", "login", "profile", "sign out"],
    body: `Open My Account to change your name, login email or password, and to sign out. Store details (name, logo, policies) live in Store Settings instead.`,
  },
  {
    id: "meta-pixel-step-by-step",
    title: "Add Meta (Facebook) Pixel step by step",
    route: "{s}/tracking",
    keywords: ["meta pixel", "facebook pixel", "pixel id", "add pixel", "pixel kaise", "events manager", "instagram ads", "fb ads"],
    body: `Getting the Pixel ID (in Meta, not here):
1. Open business.facebook.com → Events Manager → Data sources.
2. "Connect data source" → Web → name it after your store → Create.
3. Copy the 15-16 digit Pixel ID (dataset ID).
In the dashboard:
4. Open Tracking Pixels, paste the ID into "Meta Pixel ID" and Save.
5. Nothing else to install — the pixel is injected into every storefront page automatically.
6. Test: open your store, add a product to cart, then check Events Manager → Test events / Overview. You should see PageView, ViewContent, AddToCart, InitiateCheckout and Purchase.
Notes: the Purchase event fires only on a real confirmed order; manual/WhatsApp orders created inside the dashboard are intentionally not counted so ad reporting stays clean.`,
  },
  {
    id: "meta-capi",
    title: "Add the Conversions API (CAPI) token",
    route: "{s}/tracking",
    keywords: ["capi", "conversions api", "access token", "server side", "ios", "match quality", "dataset"],
    body: `CAPI sends purchases from our server to Meta, so sales are still counted when the browser pixel is blocked (iOS, ad blockers).
1. Events Manager → your dataset → Settings → Conversions API → "Generate access token".
2. Copy the token.
3. Open Tracking Pixels → Conversions API section → paste the token (and the same dataset/pixel ID) → Save.
4. Use the built-in setup wizard on that page if you get stuck; it checks each field.
5. Place a small test order and confirm in Events Manager that the Purchase event shows "Server" as a source and event deduplication is working.
Never share this token with anyone; it is stored encrypted and is never shown again.`,
  },
  {
    id: "google-analytics",
    title: "Add Google Analytics (GA4) and Search Console",
    route: "{s}/tracking",
    keywords: ["google analytics", "ga4", "measurement id", "search console", "google verification", "gtag", "seo google"],
    body: `GA4:
1. analytics.google.com → Admin → Data streams → Web → add your store URL.
2. Copy the Measurement ID (starts with G-).
3. Tracking Pixels → paste into the GA4 field → Save. Check GA4 → Realtime after opening your store.
Search Console:
4. search.google.com/search-console → add your domain property and verify with the DNS TXT record at your registrar (same place you added the domain records).
5. Submit your sitemap: https://yourdomain/sitemap.xml.`,
  },
  {
    id: "variants",
    title: "Add size / colour options (variants)",
    route: "{s}/products",
    keywords: ["variant", "size", "colour", "color", "options", "different price", "stock per size"],
    body: `1. Open the product → Variants section.
2. Add one row per option (e.g. S, M, L or Gold, Silver) with its own price and stock.
3. Leave a variant's stock at 0 to show it as sold out instead of deleting it.
4. Customers pick the option on the product page; the order shows exactly which variant was bought.`,
  },
  {
    id: "media-library",
    title: "Media Library — reuse and clean up images",
    route: "{s}/media",
    keywords: ["media", "images", "gallery", "photo", "upload", "delete image", "storage"],
    body: `Media Library holds every image you have uploaded. Use it to re-use a photo across products, copy an image URL for banners, or delete unused files. Images are served from our CDN and are resized automatically — upload the best quality you have, square works best for products.`,
  },
  {
    id: "best-sellers",
    title: "Best Sellers — pick what shows first",
    route: "{s}/best-sellers",
    keywords: ["best seller", "featured", "top products", "homepage products", "order products", "sort"],
    body: `Best Sellers controls which products get the "best seller" highlight and appear first on your storefront home. Drag to reorder or toggle products in/out. Use it after a week of sales — Analytics → Top products tells you what actually sells.`,
  },
  {
    id: "leads",
    title: "Leads — visitors who left their number",
    route: "{s}/leads",
    keywords: ["leads", "phone number", "enquiry", "spin wheel", "popup", "contact"],
    body: `Leads collects phone numbers/emails captured by checkout drop-offs, spin-wheel and popup forms. Export them or message the list from WhatsApp → Campaigns. A lead is not an order — see Abandoned Carts for people who reached checkout.`,
  },
  {
    id: "funnel",
    title: "Sales Funnel — find where sales are lost",
    route: "{s}/funnel",
    keywords: ["funnel", "drop off", "conversion", "cart abandonment", "why no sales", "checkout drop"],
    body: `The funnel shows Visitors → Product view → Add to cart → Checkout → Paid.
- Big drop at Product view: your photos/price/ad audience.
- Big drop at Add to cart → Checkout: delivery charge or trust; try free shipping above an amount and add reviews.
- Big drop at Checkout → Paid: payment friction; enable COD or partial COD, and check the Payments page for a failing gateway.`,
  },
  {
    id: "pickup-address",
    title: "Pickup address and shipping labels",
    route: "{s}/shipping-integrations",
    keywords: ["pickup address", "warehouse", "label", "awb", "manifest", "print label", "pickup request"],
    body: `1. Open Courier Partners and save your pickup address (this is where the courier collects the parcel and where RTO parcels come back).
2. Connect a courier account with the credentials from that courier's panel.
3. From an order → Ship, choose the courier, generate the AWB and print the label.
4. Tracking updates then flow into the order automatically. India Post is manual-only — you must paste status updates yourself.`,
  },
  {
    id: "manual-tracking",
    title: "Add a tracking number manually",
    route: "{s}/orders",
    keywords: ["tracking id", "awb", "manual tracking", "india post", "courier number", "update status"],
    body: `1. Open the order → Shipment.
2. Choose the courier, paste the tracking/AWB number and save.
3. The customer automatically gets the tracking link on WhatsApp and on the order-tracking page.
4. Update the shipment status as it moves (shipped → out for delivery → delivered, or returned for RTO).
RTO is available only after shipment with a verified parcel photo. Changing status never automatically refunds customer money or the ShopBanao fee.`,
  },
  {
    id: "rto-returns",
    title: "RTO, returns and refunds",
    route: "{s}/orders",
    keywords: ["rto", "return", "refund", "returned to seller", "not delivered", "money back"],
    body: `1. When a shipped parcel comes back, set its shipment status to Returned to Seller (RTO). A verified parcel photo must already be attached from shipping.
2. The order gets its own RTO status. Changing any order status does not refund the ShopBanao fee or customer payment.
3. Any customer payment refund must be handled separately by the store owner through the payment provider.
4. Add your return window and any proof requirement (e.g. an unboxing video) in Pages & Policies → Return & Refund so it shows on every product page.`,
  },
  {
    id: "export-orders",
    title: "Export orders / customers to Excel",
    route: "{s}/orders",
    keywords: ["export", "excel", "csv", "download orders", "report", "accountant"],
    body: `Use the Export button on the Orders page (and on Customers) to download the current filtered list as CSV. Filter by date range or status first, then export — that file opens directly in Excel or Google Sheets.`,
  },
  {
    id: "notifications",
    title: "Order alerts and push notifications",
    route: "/dashboard/settings",
    keywords: ["notification", "alert", "push", "new order sound", "install app", "pwa", "mobile app"],
    body: `1. Open the dashboard on your phone in Chrome and choose "Add to Home screen" (or visit /install) — it works like an app.
2. Allow notifications when asked, so you get a push for every new order.
3. Order alerts also arrive on your WhatsApp number saved in Store Settings → Basic.
If you stop getting alerts, re-open the installed app and allow notifications again in your phone's browser settings.`,
  },
  {
    id: "spin-wheel",
    title: "Spin wheel, popups and upsell apps",
    route: "{s}/apps",
    keywords: ["spin wheel", "popup", "upsell", "cross sell", "bundle", "offer wheel", "discount popup"],
    body: `Open App Store and enable the app you want:
- Spin wheel / popup: collects a phone number in exchange for a discount coupon (needs at least one active coupon).
- Upsell & bundles: suggests add-ons on the product page and after checkout.
- Shop by Video / card video: short videos on the home and product pages.
Each app has its own settings screen after you enable it, and only affects the storefront when it is switched on.`,
  },
  {
    id: "trust-videos",
    title: "Shop by Video / trust videos",
    route: "{s}/apps",
    keywords: ["video", "shop by video", "reel", "trust video", "instagram video"],
    body: `1. App Store → enable Shop by Video.
2. Upload short vertical videos (like Instagram reels) and link each one to a product.
3. They appear in a swipeable row on your storefront; tapping opens the product. Keep files under ~20MB so they load fast on mobile.`,
  },
  {
    id: "prepaid-discount",
    title: "Push prepaid orders (reduce COD/RTO)",
    route: "{s}/payments",
    keywords: ["prepaid discount", "cod charge", "rto", "advance", "partial cod", "reduce cod"],
    body: `On the Payments page you can:
- Give a prepaid discount (flat or %) so paying online is cheaper than COD.
- Add a COD handling fee.
- Turn on partial COD: the customer pays a small advance (e.g. ₹100) online and the rest on delivery. This cuts fake orders, but a high advance also increases drop-off at checkout — start low and watch the Sales Funnel.`,
  },
  {
    id: "coupons-auto",
    title: "Auto-apply and recovery coupons",
    route: "{s}/coupons",
    keywords: ["auto apply", "recovery coupon", "first order", "welcome code", "free shipping coupon"],
    body: `1. Coupons → Create: set code, flat/% value, minimum cart value, usage limit and expiry.
2. Mark a coupon "auto apply" so it is applied for every customer without typing a code (good for launch offers).
3. Mark one as the recovery coupon — abandoned-cart WhatsApp messages and the spin wheel use it automatically.`,
  },
  {
    id: "back-in-stock",
    title: "Out of stock, back-in-stock and wishlist",
    route: "{s}/products",
    keywords: ["out of stock", "sold out", "back in stock", "waitlist", "wishlist", "inventory"],
    body: `Set stock to 0 to show a product as sold out; customers can leave their number on the "notify me" form and appear in Leads / the back-in-stock list. Update the stock and message them from WhatsApp → Campaigns. Wishlist saves are visible per customer on the Customers page.`,
  },
  {
    id: "hidden-categories",
    title: "Hide a category or product from the storefront",
    route: "{s}/categories",
    keywords: ["hide", "hidden", "unpublish", "draft", "not visible", "remove from store"],
    body: `1. Categories → toggle "hidden" on a category. Every product that only belongs to hidden categories disappears from the storefront automatically (links you share still work).
2. To hide a single product, open it and turn its status to inactive/draft.
Use hiding instead of deleting so past orders keep their product details.`,
  },
  {
    id: "custom-pages",
    title: "Create a custom page (FAQ, size guide, story)",
    route: "{s}/pages",
    keywords: ["custom page", "new page", "faq", "size guide", "blog", "footer link"],
    body: `1. Pages & Policies → "New page".
2. Give it a title and URL slug, write the content (AI can draft it), and save.
3. Choose whether it appears in the storefront footer. The page is live at yourdomain/pages/your-slug.`,
  },
  {
    id: "store-not-found",
    title: "Store shows an error or \"store not found\"",
    route: "{s}/domain",
    keywords: ["store not found", "error", "not opening", "site down", "404", "blank"],
    body: `1. Check the free address first (yourslug.shopbanao.in). If that works, the problem is your custom domain's DNS — re-check the records on the Domain page and press Verify again.
2. Press "Purge Cache" in the dashboard header and hard-refresh (Ctrl/Cmd + Shift + R).
3. Confirm your store is not paused and your wallet is not blocked in Wallet.
4. Still broken? Contact support with the exact link — do not delete and recreate the store.`,
  },
  {
    id: "partner-program",
    title: "Partner / referral program",
    route: "/partners",
    keywords: ["partner", "referral", "affiliate", "commission earn", "refer"],
    body: `The Partner program is for people who refer new sellers to the platform. Sign up at /partners, share your referral link, and earn commission on the stores you bring — tracked in the partner dashboard with its own wallet and withdrawals. It is separate from your store's wallet.`,
  },
  {
    id: "launch-checklist",
    title: "Launch checklist — what to finish before ads",
    route: "/dashboard",
    keywords: ["launch", "checklist", "go live", "ready", "start selling", "first order", "before ads"],
    body: `Before you spend on ads, finish all of these:
1. At least 5-10 products with good photos, price and description.
2. Categories created and assigned.
3. Payments: one online gateway working + COD decided (test with a ₹1-10 order).
4. Shipping rates and free-shipping threshold set; courier or manual tracking ready.
5. Pages & Policies: About, Contact, Return/Refund, Shipping, Privacy (gateways check these).
6. Store Settings: name, logo, WhatsApp number, address, SEO title/description.
7. Tracking Pixels: Meta Pixel + CAPI (and GA4) verified with a test order.
8. Domain connected and verified; store link shared once on WhatsApp/Instagram.
9. Wallet recharged so commission never blocks orders.`,
  },
  {
    id: "create-store",
    title: "Create a new store / open another store",
    route: "/dashboard/stores/create",
    keywords: ["create store", "new store", "second store", "another store", "open store", "store banana", "switch store"],
    body: `1. Go to Dashboard → Stores → "Create store".
2. Enter the store name; the link (slug) is made from it — yourslug.shopbanao.in.
3. Pick your business type (jewellery, clothing, watches, electronics, or type your own) and your name. The AI writes your About Us, store description and SEO text from this — you can edit it later in Store Settings.
4. Save. You land on the new store's dashboard.
To switch between stores use the store name at the top of the sidebar, or Dashboard → Stores.`,
  },
  {
    id: "account-login",
    title: "Login, password and account email",
    route: "/dashboard/settings",
    keywords: ["login", "password", "forgot password", "reset password", "email change", "sign in", "logout", "account"],
    body: `Forgot your password: on the login page press "Forgot password", enter your account email and open the reset link sent to that email (check spam).
Change password or profile name: Account settings (/dashboard/settings).
Logging in on a new phone works with the same email/password — your stores follow the account, not the device.
Never share your password. Our team will never ask for it, and this assistant cannot see or reset it.`,
  },
  {
    id: "order-status-meaning",
    title: "What each order status means",
    route: "{s}/orders",
    keywords: ["status meaning", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "partially paid", "what does"],
    body: `pending — order created, payment not completed yet. It is auto-closed if the customer never pays.
partially_paid — partial COD: the advance is paid, the rest is collected at delivery. This is a real order, pack it.
paid / confirmed — money received (or COD accepted). Pack and ship.
processing — you are preparing it.
shipped — handed to the courier. Shipped means fulfilment only, NOT that the parcel was delivered or that the money is final.
delivered — customer received it.
cancelled — order closed; changing the status does not automatically refund any payment or ShopBanao fee.
rto — a shipped parcel was returned to the seller; verified parcel evidence is required and the ShopBanao fee remains charged.`,
  },
  {
    id: "commission-3-percent",
    title: "How much the platform charges (3%)",
    route: "{s}/wallet",
    keywords: ["commission", "charges", "fee", "3%", "subscription", "monthly", "kitna charge", "cost", "pricing"],
    body: `There is no monthly subscription. The platform takes a flat 3% of every order, including orders that come back as RTO. It is deducted from your store wallet, not from the customer.
Payment gateway charges (Razorpay/Cashfree/PayU) are separate and charged by that gateway.
Keep your wallet topped up — if the balance runs out, new orders can be blocked. See Wallet for the ledger of every deduction.`,
  },
  {
    id: "payout-settlement",
    title: "When do I get my money (settlement)",
    route: "{s}/payments",
    keywords: ["payout", "settlement", "when money", "paisa kab", "bank", "withdraw", "kab milega", "t+2"],
    body: `Online payments go straight to YOUR gateway account (Razorpay/Cashfree/PayU/UPI), not to us. The gateway settles to your bank on its own cycle — usually T+2 working days. Check the payout schedule inside your gateway's own dashboard.
COD money is collected by the courier and remitted by them, usually 7-10 days after delivery.
The platform only deducts its 2% commission from your store wallet — it never holds your order money.`,
  },
  {
    id: "test-order",
    title: "Place a test order safely",
    route: "{s}/orders",
    keywords: ["test order", "trial order", "check payment", "10 rupees", "dummy order", "verify checkout"],
    body: `1. Open your live store link in a normal (non-logged-in) browser or phone.
2. Add any product, or temporarily create a ₹10 test product, and check out with your real number.
3. Pay with UPI. Confirm you land on the order-success page and get the WhatsApp confirmation.
4. Open Orders in the dashboard — the order should show paid/confirmed with the transaction id.
5. Cancel/refund the test order and hide the test product.
Do this after every payment, pixel or shipping change — it is the fastest way to prove the whole flow works.`,
  },
  {
    id: "payment-stuck",
    title: "Money deducted but order shows pending",
    route: "{s}/orders",
    keywords: ["money deducted", "payment stuck", "pending payment", "paisa kat gaya", "not confirmed", "failed but paid", "phonepe", "upi pending"],
    body: `1. Open the order in Orders and check the transaction id / gateway reference.
2. Wait 5-10 minutes — our reconciliation job re-checks the gateway and flips genuine payments to paid automatically, and the customer gets the WhatsApp confirmation.
3. Still pending after that: open your gateway dashboard and search that reference. If the gateway shows SUCCESS, mark the order paid in the dashboard and ship it. If the gateway shows FAILED, the bank will auto-refund the customer in 3-5 working days — tell them that.
4. Never ask the customer to pay twice before checking the gateway.`,
  },
  {
    id: "why-cancelled-orders",
    title: "Why do I see so many pending / cancelled orders",
    route: "{s}/funnel",
    keywords: ["too many cancelled", "cancel kyu", "pending orders many", "abandoned", "drop off", "failed checkout"],
    body: `Most cancelled rows are not a broken checkout — they are customers who opened the payment screen and never paid. The system closes an unpaid order after a few minutes so your list stays clean.
What to check: Sales Funnel shows where people drop. If a lot drop at the advance step, your partial-COD advance may be too high — lower it in Payments. If they drop at delivery charge, add a free-shipping threshold.
What to fix instead of worrying: enable UPI + one card gateway, keep COD on, and turn on Abandoned Carts WhatsApp recovery.`,
  },
  {
    id: "refund-customer",
    title: "Refund money to a customer",
    route: "{s}/orders",
    keywords: ["refund", "return money", "paisa wapas", "money back", "reverse payment"],
    body: `1. Cancel the order in Orders (open the order → Cancel) so revenue and stock are corrected.
2. Refund the actual money from the gateway that took it — Razorpay/Cashfree/PayU dashboards each have a Refund button on that transaction. Refunds reach the customer in 3-7 working days.
3. For UPI-direct payments you refund manually from your own UPI/bank app.
4. If the order was already shipped and you cancel it, the platform's 2% commission is automatically credited back to your wallet.
5. Tell the customer the refund reference on WhatsApp.`,
  },
  {
    id: "invoice-gst-bill",
    title: "Invoice / GST bill for an order",
    route: "{s}/orders",
    keywords: ["invoice", "bill", "gst bill", "receipt", "tax invoice", "print"],
    body: `Open Orders → the order → Invoice to view and print/save the bill. It uses your store name, address and GSTIN from Store Settings and Tax settings, so fill those first or the invoice prints without them.
Set GST rate and inclusive/exclusive pricing in Tax & GST before you generate invoices you plan to file.`,
  },
  {
    id: "packing-slip-label",
    title: "Packing slip and shipping label",
    route: "{s}/orders",
    keywords: ["label", "packing slip", "print label", "awb print", "shipping label"],
    body: `For courier-integrated shipments (Shiprocket/Delhivery etc.), book the shipment from the order and the label/AWB is generated by the courier — print it from the order's shipment panel.
For manual couriers (like India Post), there is no auto label: write the address from the order, then add the tracking number manually on the order so the customer's tracking page updates.`,
  },
  {
    id: "pincode-serviceability",
    title: "Pincode, delivery area and delivery time",
    route: "{s}/shipping",
    keywords: ["pincode", "serviceable", "delivery area", "kitne din", "delivery time", "eta", "cod pincode"],
    body: `Shipping Rates decides where and how much you charge — set your zones/rates and the free-shipping threshold there.
If you only ship to some states, keep COD limited and say so on your Shipping Policy page (Pages & Policies).
Estimated delivery text shown on the product page comes from your shipping settings/policy — keep it realistic (e.g. 4-7 days) to reduce "where is my order" messages.`,
  },
  {
    id: "low-stock",
    title: "Stock, out-of-stock and low stock",
    route: "{s}/products",
    keywords: ["stock", "out of stock", "inventory", "sold out", "quantity", "restock"],
    body: `Stock drops automatically as orders come in. At 0 the product shows "Out of stock" and cannot be bought.
To restock: Products → edit the product (or the variant) → set the quantity.
Turn on Back-in-stock alerts so customers leave their number and get a WhatsApp when you restock.
If you never track stock for an item, set a large quantity rather than 0.`,
  },
  {
    id: "delete-product-store",
    title: "Delete or hide a product / delete a store",
    route: "{s}/products",
    keywords: ["delete product", "remove product", "hide product", "delete store", "close store", "unpublish"],
    body: `Hide instead of delete when you may sell it again: edit the product and turn it inactive/hidden — old order history stays intact.
Delete permanently: Products → the row's delete action. This cannot be undone and removes it from the catalog.
To close a store, first stop ads and remove the domain; ask support before deleting a store that has orders — order and invoice history is lost.`,
  },
  {
    id: "product-photos",
    title: "Photos that sell (size, quality, speed)",
    route: "{s}/media",
    keywords: ["photo", "image size", "quality", "blurry", "slow images", "compress", "background"],
    body: `Use square photos (1000x1000 or larger), plain/white background, product filling the frame.
First image = the catalog thumbnail, so make it the clearest one. Add 3-5 angles plus one lifestyle/worn shot.
Do not upload 5-10MB camera files — resize to under ~1MB; images are optimised and served from our CDN, but huge originals still slow the first upload.
Reuse images across products from Media Library instead of uploading twice.`,
  },
  {
    id: "seo-product",
    title: "Get found on Google (store and product SEO)",
    route: "{s}/settings#seo",
    keywords: ["seo", "google", "rank", "search", "meta title", "keywords", "indexing"],
    body: `1. Store Settings → SEO: set a title under 60 characters with your main keyword (e.g. "Gold-plated imitation jewellery online — MaVirat") and a description under 160 characters.
2. Give every product a descriptive name (material + type + occasion), not "Item 12".
3. Write 3-4 real sentences in each product description.
4. Connect your own domain — it ranks better than a subdomain.
5. Add Google Search Console from Tracking Pixels and submit your sitemap.
Google usually takes 1-3 weeks to show a new store; run Meta ads meanwhile.`,
  },
  {
    id: "whatsapp-campaign",
    title: "Send a WhatsApp campaign to customers",
    route: "{s}/whatsapp",
    keywords: ["whatsapp campaign", "bulk whatsapp", "broadcast", "message customers", "template", "marketing message"],
    body: `1. Open WhatsApp in the sidebar.
2. Pick or create an approved template — marketing messages must use an approved template, plain free text is not allowed outside a 24-hour reply window.
3. Choose the audience (all customers, buyers of a category, abandoned carts).
4. Send or schedule. Delivery, reads and link clicks are shown per campaign.
Rules that protect your number: never message people who opted out, keep sends relevant, and space out large blasts.`,
  },
  {
    id: "order-notifications",
    title: "Get alerted the moment an order comes",
    route: "{s}/orders",
    keywords: ["notification", "alert", "new order sound", "app install", "pwa", "push"],
    body: `1. Allow notifications when the dashboard asks — you then get a push for every new order.
2. Install the dashboard as an app: open /install (or your browser's "Add to home screen") so it opens like a normal app and keeps you logged in.
3. Order confirmations to the customer go out on WhatsApp automatically.
If pushes stop, re-allow notifications in your browser/phone site settings.`,
  },
  {
    id: "find-anything",
    title: "Find any page fast (search and shortcuts)",
    route: "/dashboard",
    keywords: ["search", "find page", "shortcut", "command palette", "menu", "where is", "navigation"],
    body: `Press Ctrl/Cmd + K anywhere in the dashboard to search every page by name ("pixel", "coupon", "GST") and jump to it.
The sidebar is grouped: Overview, Catalog, Orders & Customers, Payments & Shipping, Marketing & Growth, Store Setup, Account. Less-used pages sit under "More".
On mobile the bottom bar has the five pages you use daily; everything else is under the More menu.
Store Settings has jump-chips at the top (Basic, Location, Media, Display, Pages, SEO, AI, Domain) so you don't scroll.`,
  },
  {
    id: "store-slow",
    title: "My store loads slowly",
    route: "{s}/theme",
    keywords: ["slow", "speed", "loading", "performance", "lag", "page speed"],
    body: `1. Oversized images are the usual cause — keep uploads under ~1MB each and 3-6 images per product.
2. Avoid very long home pages; keep 4-6 sections in Theme & Design.
3. Turn off apps/popups you are not actually using in App Store.
4. Press Purge Cache after big changes, then test again on mobile data, not office wifi.
The storefront is served from a global CDN, so after the first load repeat visits are fast.`,
  },
  {
    id: "wallet-blocked",
    title: "Wallet empty / store blocked",
    route: "{s}/wallet",
    keywords: ["wallet blocked", "recharge", "balance low", "negative", "orders blocked", "top up"],
    body: `The 2% commission is deducted per order from the store wallet. If the balance goes to zero, order creation can be blocked so you don't run up dues.
Fix: Wallet → Recharge → pay via UPI/gateway; the balance updates within a minute or two of a successful payment.
Keep a buffer of at least a few hundred rupees when running ads, and check the ledger to see every deduction with its order number.`,
  },
  {
    id: "grow-sales",
    title: "I'm getting visitors but no sales",
    route: "{s}/funnel",
    keywords: ["no sales", "no orders", "traffic no order", "conversion", "sale nahi", "grow", "increase sales"],
    body: `Work down the funnel in order:
1. Sales Funnel — see where people stop (view → cart → checkout → paid).
2. Trust: reviews on products, real photos, Return/Refund and Contact pages filled, trust videos on.
3. Friction: enable UPI, keep COD or a small partial-COD advance, add a free-shipping threshold.
4. Urgency: a first-order coupon (auto-apply), spin wheel, and abandoned-cart WhatsApp recovery.
5. Ads: verify Meta Pixel + CAPI with a test order first, otherwise Meta cannot optimise.
Change one thing at a time and compare a week against a week in Analytics.`,
  },
  {
    id: "revenue-mismatch",
    title: "Dashboard revenue doesn't match my bank",
    route: "/dashboard/analytics",
    keywords: ["revenue wrong", "mismatch", "sales figure", "not matching", "report", "total sales"],
    body: `Dashboard revenue counts orders (paid, partially paid, confirmed), not bank credits, so it will always run ahead of your bank:
- COD money arrives only after the courier remits it.
- Gateway settlements land T+2, minus gateway fees.
- Cancelled and RTO orders should be marked cancelled — until you do, they inflate revenue.
- Partial-COD orders count the full order value; only the advance has actually reached the gateway.
Reconcile monthly: Analytics for orders, your gateway report for settlements, courier statement for COD.`,
  },
  {
    id: "customer-support-flow",
    title: "Answering customer questions (where is my order etc.)",
    route: "{s}/orders",
    keywords: ["customer asking", "where is my order", "support", "complaint", "customer service", "reply"],
    body: `1. Search the order by phone number or order id in Orders.
2. Open it — you see items, payment, address and shipment status with the tracking link. Send that link on WhatsApp.
3. No tracking yet? Say the honest dispatch date from your shipping policy instead of guessing.
4. Damage/wrong item: ask for the unboxing video and photos before approving a return (some stores make the unboxing video mandatory — it is written on the product page).
5. Log the outcome by updating the order status so your reports stay clean.`,
  },
];


