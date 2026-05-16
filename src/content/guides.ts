/**
 * Marketing guides for SEO content marketing on shopbanao.in.
 *
 * Each guide targets a high-intent India keyword identified by Semrush.
 * Lives on the LandingApp (no Supabase, no React Query) to keep the
 * landing critical path light. Content is plain TS to avoid the MDX
 * toolchain.
 *
 * To add a guide: append an entry, push the slug into the sitemap
 * generator (or public/sitemap.xml), and ensure the title/description
 * use the target keyword naturally.
 */
export type Guide = {
  slug: string;
  title: string;
  description: string;
  /** Display label shown on the index card */
  category: string;
  /** ISO date */
  updatedAt: string;
  /** Read-time in minutes (shown in card) */
  readingTime: number;
  /** Inline HTML body — pre-escaped, safe for dangerouslySetInnerHTML */
  contentHtml: string;
};

const baseCta = `
<div class="rounded-xl border border-primary/30 bg-primary/5 p-6 my-10 text-center">
  <h3 class="text-xl font-bold mb-2">Ready to launch your store?</h3>
  <p class="text-muted-foreground mb-4">Create a free store in 2 minutes — no credit card needed.</p>
  <a href="/signup" class="inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">Start free</a>
</div>
`;

export const guides: Guide[] = [
  {
    slug: "how-to-create-whatsapp-store-india",
    title: "How to create a WhatsApp store in India (2026 guide)",
    description:
      "Step-by-step: turn WhatsApp into a full online store with product catalog, payments, and order tracking. Free options compared.",
    category: "Getting started",
    updatedAt: "2026-05-16",
    readingTime: 7,
    contentHtml: `
<p class="lead">A <strong>WhatsApp store</strong> lets you take orders, accept payments, and ship products without building a website from scratch. In India, WhatsApp Business has over 500 million users, making it the cheapest, fastest way to start selling online. This guide walks through the full setup in under 30 minutes.</p>

<h2>What is a WhatsApp store?</h2>
<p>A WhatsApp store is an online shop where customers browse your product catalog and place orders through WhatsApp chat. Unlike a regular WhatsApp Business catalog, a full WhatsApp store includes:</p>
<ul>
  <li>A shareable storefront link (e.g. <code>brand.shopbanao.in</code>) with category navigation</li>
  <li>UPI, card, and Cash-on-Delivery payment options</li>
  <li>Automatic order notifications to your WhatsApp</li>
  <li>An admin dashboard to manage stock, orders, and customers</li>
</ul>

<h2>Why a WhatsApp store wins in India</h2>
<p>Three reasons most Indian D2C brands start on WhatsApp before opening on Amazon or Flipkart:</p>
<ol>
  <li><strong>Zero acquisition cost.</strong> Customers already use WhatsApp daily — no app install needed.</li>
  <li><strong>Higher conversion.</strong> Conversational ordering converts 3-4× better than email or web checkout for first-time buyers under ₹2,000.</li>
  <li><strong>Cash-on-Delivery built in.</strong> 60%+ of Tier 2 & 3 orders are COD; WhatsApp confirmation reduces RTO (return-to-origin) rates by ~40%.</li>
</ol>

<h2>Step 1: Plan your product catalog</h2>
<p>Before you build, list 10-50 products with these details for each: name, 1-3 photos, price, short description, stock count, and category (e.g. <em>sarees, kurtis, accessories</em>). Spreadsheet works fine.</p>

<h2>Step 2: Pick a WhatsApp store builder</h2>
<p>You have three options:</p>
<ul>
  <li><strong>WhatsApp Business catalog only</strong> — free, but no real checkout, no UPI auto-collect, no inventory sync. Fine for &lt;10 products.</li>
  <li><strong>DIY website + WhatsApp button</strong> — Shopify, WooCommerce. Costs ₹2,000-5,000/month and needs a designer.</li>
  <li><strong>Dedicated WhatsApp store builder</strong> — Storivo (ShopBanao), Dukaan, BikiShop. Free plans cover up to 100 products with UPI, COD, and order tracking built in.</li>
</ul>
<p>For most first-time sellers, the third option is the fastest path. <a href="/signup">ShopBanao gives you a free WhatsApp store</a> with your own subdomain (or custom domain), Razorpay/Cashfree UPI, and automatic order notifications to your WhatsApp Business number.</p>

<h2>Step 3: Set up your storefront</h2>
<ol>
  <li>Sign up and choose a subdomain (e.g. <code>shringaar.shopbanao.in</code>).</li>
  <li>Add your store name, logo, WhatsApp Business number, and a one-line description.</li>
  <li>Pick a theme — modern, minimal, or boutique look — and customise colours to match your brand.</li>
  <li>Add your first 5-10 products with photos, prices, and categories.</li>
</ol>

<h2>Step 4: Enable payments</h2>
<p>For India, the recommended stack is:</p>
<ul>
  <li><strong>UPI Intent</strong> — opens GPay/PhonePe/Paytm directly. Zero gateway fee.</li>
  <li><strong>Razorpay or Cashfree</strong> — UPI, cards, netbanking, wallets. ~2% transaction fee.</li>
  <li><strong>Cash-on-Delivery</strong> — must-have for Tier 2-3 customers.</li>
</ul>

<h2>Step 5: Share your store on WhatsApp</h2>
<p>Once live, you get a single link to share — in your WhatsApp status, broadcast lists, Instagram bio, or paid ads. Every order auto-notifies you on WhatsApp with the customer's name, address, and payment status.</p>

${baseCta}

<h2>Common questions</h2>
<h3>Is a WhatsApp store free?</h3>
<p>Yes. ShopBanao, Dukaan, and most modern builders offer a free plan covering up to 100 products. You only pay if you want a custom domain, advanced themes, or higher product limits.</p>

<h3>Do I need GST registration?</h3>
<p>Not for personal sales under ₹40 lakh/year (services) or ₹20 lakh/year (intra-state). Above that, GST registration is mandatory. Most store builders let you add your GSTIN later.</p>

<h3>Can I run a WhatsApp store without WhatsApp Business?</h3>
<p>Yes, but a regular WhatsApp number works less well — no auto-replies, no business profile, no labels. WhatsApp Business is free and takes 5 minutes to set up.</p>
`,
  },
  {
    slug: "best-online-store-builder-india",
    title: "Best free online store builder for India (2026)",
    description:
      "Compared: ShopBanao, Dukaan, Bikayi, Shopify. Pricing, features, payment gateways, and which one fits Indian sellers.",
    category: "Comparisons",
    updatedAt: "2026-05-16",
    readingTime: 8,
    contentHtml: `
<p class="lead">If you're looking for the <strong>best online store builder in India</strong>, the right pick depends on your product count, payment needs, and whether you want a custom domain. Here's a clear comparison of the top free options for Indian sellers in 2026.</p>

<h2>What "best" means for India</h2>
<p>Most global builders (Shopify, BigCommerce, Wix) are built for the US/EU market. Indian sellers need:</p>
<ul>
  <li>UPI as a first-class payment method (not an after-thought)</li>
  <li>Cash-on-Delivery support</li>
  <li>WhatsApp ordering and order notifications</li>
  <li>GSTIN field on invoices</li>
  <li>Pincode-based shipping zones</li>
  <li>Pricing in ₹ (no USD conversion surprises)</li>
</ul>

<h2>1. ShopBanao (Storivo)</h2>
<p><strong>Best for:</strong> First-time sellers who want a WhatsApp-first store with UPI, COD, and a free subdomain.</p>
<ul>
  <li>Free plan: up to 100 products, subdomain (e.g. <code>brand.shopbanao.in</code>)</li>
  <li>UPI Intent (GPay/PhonePe direct), Razorpay, Cashfree, COD</li>
  <li>WhatsApp order notifications + customer chat</li>
  <li>20 modern themes, custom domain on paid plan</li>
  <li>India-focused: GSTIN, pincode shipping, INR pricing</li>
</ul>

<h2>2. Dukaan (MyDukaan)</h2>
<p><strong>Best for:</strong> Established sellers with 100+ products who want extensive plugin marketplace.</p>
<ul>
  <li>Free plan with subdomain; paid starts at ₹599/month</li>
  <li>UPI, Razorpay, COD, Stripe (international)</li>
  <li>Large plugin ecosystem</li>
  <li>Mobile-first dashboard</li>
</ul>

<h2>3. Bikayi</h2>
<p><strong>Best for:</strong> Hyperlocal businesses that already drive traffic from WhatsApp groups.</p>
<ul>
  <li>Free plan with limited features</li>
  <li>Strong WhatsApp integration</li>
  <li>Simple inventory management</li>
</ul>

<h2>4. Shopify</h2>
<p><strong>Best for:</strong> Established brands selling internationally or doing &gt;₹50 lakh/month.</p>
<ul>
  <li>Starts at ~₹2,000/month (Basic plan)</li>
  <li>Huge theme + app ecosystem</li>
  <li>Weak India payment defaults — needs Razorpay plugin</li>
  <li>No native COD; needs paid app</li>
  <li>USD-billed; ₹ pricing is a workaround</li>
</ul>

<h2>Side-by-side comparison</h2>
<div class="overflow-x-auto"><table class="w-full text-sm border-collapse my-4">
<thead><tr class="bg-muted"><th class="p-2 text-left">Feature</th><th class="p-2">ShopBanao</th><th class="p-2">Dukaan</th><th class="p-2">Bikayi</th><th class="p-2">Shopify</th></tr></thead>
<tbody>
<tr><td class="p-2 border-t">Free plan</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">✗</td></tr>
<tr><td class="p-2 border-t">UPI Intent</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">via plugin</td></tr>
<tr><td class="p-2 border-t">COD</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">paid app</td></tr>
<tr><td class="p-2 border-t">WhatsApp ordering</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">limited</td><td class="p-2 border-t text-center">✓</td><td class="p-2 border-t text-center">via plugin</td></tr>
<tr><td class="p-2 border-t">Custom domain (free)</td><td class="p-2 border-t text-center">paid</td><td class="p-2 border-t text-center">paid</td><td class="p-2 border-t text-center">paid</td><td class="p-2 border-t text-center">paid</td></tr>
<tr><td class="p-2 border-t">Starting price</td><td class="p-2 border-t text-center">Free</td><td class="p-2 border-t text-center">Free</td><td class="p-2 border-t text-center">Free</td><td class="p-2 border-t text-center">₹2,000/mo</td></tr>
</tbody></table></div>

<h2>Our recommendation</h2>
<p>For most Indian sellers starting out, <strong>ShopBanao is the best free online store builder</strong> because it ships with UPI Intent, COD, WhatsApp order notifications, and 20 themes out of the box — no plugins, no setup fees. When you outgrow the free plan, the custom-domain upgrade adds 24/7 priority support and a 1,000+ product catalog.</p>

${baseCta}

<h2>FAQs</h2>
<h3>Which builder has the lowest payment gateway fees?</h3>
<p>UPI Intent (used by ShopBanao and Dukaan) charges zero gateway fee for &lt;₹2,000 transactions. Razorpay and Cashfree both charge ~2% on UPI/cards.</p>

<h3>Can I migrate from one builder to another?</h3>
<p>Yes. All major builders let you export products as CSV. Customer and order history is usually harder to move, so plan upgrades carefully.</p>
`,
  },
  {
    slug: "shopify-alternative-india",
    title: "5 best Shopify alternatives for Indian sellers (2026)",
    description:
      "Shopify is great globally but expensive for Indian D2C brands. Here are 5 cheaper, India-first alternatives with UPI, COD, and WhatsApp.",
    category: "Comparisons",
    updatedAt: "2026-05-16",
    readingTime: 6,
    contentHtml: `
<p class="lead">Shopify is a powerful platform but it was built for the US/EU market. For Indian sellers, the monthly subscription (₹2,000+), the need to install plugins for UPI and COD, and USD billing make it expensive and clunky. Here are five <strong>Shopify alternatives in India</strong> that are cheaper, faster to set up, and India-native.</p>

<h2>Why look for a Shopify alternative?</h2>
<ul>
  <li><strong>Cost.</strong> Shopify Basic = ₹2,000+/month. India-first builders start free.</li>
  <li><strong>UPI as default.</strong> Shopify needs the Razorpay plugin; India builders ship UPI Intent natively.</li>
  <li><strong>COD support.</strong> Shopify needs a paid app; India builders include it free.</li>
  <li><strong>WhatsApp ordering.</strong> Critical for India D2C — native in most local builders.</li>
  <li><strong>Pincode shipping.</strong> India-specific zones (metro / Tier-2 / NE) are built-in elsewhere.</li>
</ul>

<h2>1. ShopBanao (Storivo) — Best free Shopify alternative</h2>
<p>Free plan with subdomain, UPI Intent, Razorpay, Cashfree, COD, WhatsApp ordering, and 20 themes. Custom domain available on paid plan. <a href="/signup">Start free</a>.</p>

<h2>2. Dukaan</h2>
<p>Mobile-first store builder. Free plan available; paid plans from ₹599/month. Strong plugin ecosystem.</p>

<h2>3. Instamojo</h2>
<p>Best known as a payments platform; the storefront is simple but the payment-link flow is excellent. Good for small product counts and digital goods.</p>

<h2>4. Bikayi</h2>
<p>Strong WhatsApp integration. Great for hyperlocal sellers driving traffic from WhatsApp groups.</p>

<h2>5. KartRocket / Shiprocket Engage</h2>
<p>Built by Shiprocket. Integrated shipping discounts. Good for sellers already using Shiprocket for logistics.</p>

<h2>Which one should I pick?</h2>
<p>If you're starting out and want a free, India-first Shopify alternative with UPI, COD, WhatsApp, and modern themes, <strong>ShopBanao is the strongest free option</strong>. If you're already doing &gt;₹50 lakh/month and need international expansion, Shopify still wins on app ecosystem.</p>

${baseCta}

<h2>FAQs</h2>
<h3>Is Shopify worth it for Indian sellers?</h3>
<p>Only if you need international sales, multiple stores, or specific apps that aren't in the India ecosystem yet. For domestic D2C, an India-first builder is usually cheaper and faster.</p>

<h3>Can I move from Shopify to an Indian builder?</h3>
<p>Yes — most India-first builders import Shopify product CSVs. Orders and customer history typically need a manual export.</p>
`,
  },
];

export function getGuide(slug: string): Guide | undefined {
  return guides.find((g) => g.slug === slug);
}
