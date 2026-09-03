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
2. If the store is on commission billing and the order was already shipped, changing shipped → cancelled automatically refunds that order's commission to your wallet.
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
5. If an order is cancelled after shipping, its commission is refunded to the wallet automatically.`,
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
];
