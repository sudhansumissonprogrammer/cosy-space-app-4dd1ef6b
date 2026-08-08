/**
 * Default page content templates used for seeding system pages.
 * Store owners can edit or remove this content from the Pages manager.
 */

interface StoreInfo {
  name: string;
  description?: string | null;
  whatsapp_number?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  owner_name?: string | null;
}

function contactLine(store: StoreInfo): string {
  return store.whatsapp_number
    ? `WhatsApp us at ${store.whatsapp_number}`
    : "contact us through our Contact page";
}

function addressLine(store: StoreInfo): string {
  return [store.location, store.city, store.state].filter(Boolean).join(", ");
}

export function getDefaultReturnPolicy(store: StoreInfo): string {
  const contact = contactLine(store);
  const address = addressLine(store);

  return `At ${store.name}, customer satisfaction is our top priority. Please read our complete Return, Refund & Cancellation policy below.

Order Cancellation
• Orders can be cancelled before they are shipped or dispatched.
• To cancel an order, ${contact} with your order details as soon as possible.
• Once an order has been shipped, it cannot be cancelled — you may initiate a return instead.
• If payment was already collected, the full amount will be refunded to the original payment method within 5–7 business days of cancellation confirmation.

Returns

Eligibility
• Items must be returned within 7 days of delivery.
• Products must be unused, unwashed, and in original packaging with all tags attached.
• Proof of purchase (order confirmation or receipt) is required.

Non-Returnable Items
• Perishable goods (food, flowers, etc.)
• Intimate or sanitary products
• Customized or personalized items
• Gift cards and downloadable products
• Items marked as "Final Sale"

How to Initiate a Return
1. ${contact} with your order number and reason for return.
2. We'll provide return instructions and a return authorization.
3. Pack the item securely and ship it back (return shipping costs may apply unless the item is defective).

Refunds
• Once we receive and inspect the returned item, we will notify you of the approval or rejection of your refund.
• Approved refunds will be processed within 5–7 business days to the original payment method.
• Shipping charges are non-refundable unless the return is due to our error (wrong or defective item).
• If you haven't received your refund after the stated period, please ${contact}.

Exchanges
If you received a defective or damaged item, please ${contact} immediately. We'll arrange a replacement at no extra cost, subject to availability.

Contact Us
For any questions about returns, refunds, or cancellations, please ${contact}. We're happy to assist you.${address ? `\n\nAddress: ${address}` : ""}`;
}

export function getDefaultShippingPolicy(store: StoreInfo): string {
  const contact = contactLine(store);
  const area = [store.city, store.state].filter(Boolean).join(", ");

  return `Thank you for shopping at ${store.name}! Here's everything you need to know about our shipping process.

Processing Time
Orders are processed within 1–3 business days after payment confirmation. Orders placed on weekends or holidays will be processed the next business day.

Shipping Areas
We currently ship ${area ? `from ${area} ` : ""}across India. International shipping availability varies by product — please ${contact} for details.

Delivery Estimates
• Local delivery${area ? ` (${area})` : ""}: 1–3 business days
• Domestic (rest of India): 5–7 business days
• Remote areas: 7–10 business days
Delivery times are estimates and may vary due to external factors.

Shipping Costs
Shipping charges are calculated at checkout based on your delivery location and order weight. We may offer free shipping on orders above a certain amount — check the store for current offers.

Order Tracking
Once your order is shipped, you'll receive a tracking number via WhatsApp or email. You can use it to track your package with the courier partner.

Damaged or Lost Packages
If your package arrives damaged or doesn't arrive within the estimated timeframe, please ${contact}. We'll investigate and resolve the issue promptly.

Contact Us
For shipping inquiries, please ${contact}. We're here to help!`;
}

export function getDefaultPrivacyPolicy(store: StoreInfo): string {
  const contact = contactLine(store);
  const address = addressLine(store);

  return `At ${store.name}, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you visit or make a purchase from our store.

1. Information We Collect
We may collect the following types of information:
• Personal Information: Name, email address, phone number, shipping and billing address when you place an order or contact us.
• Payment Information: Payment details are processed securely by third-party payment gateways. We do not store your card or bank details.
• Browsing Data: IP address, browser type, device information, pages visited, and time spent on our website (collected automatically via cookies and analytics tools).
• Communication Data: Messages or inquiries you send us via WhatsApp, email, or our contact form.

2. How We Use Your Information
• To process and fulfill your orders, including shipping and payment.
• To communicate with you about your orders, inquiries, and customer support.
• To improve our website, products, and customer experience.
• To send promotional offers or updates (only if you have opted in; you can unsubscribe at any time).
• To comply with legal obligations and prevent fraud.

3. Cookies & Tracking
Our website may use cookies and similar technologies to enhance your browsing experience, remember your preferences, and analyze website traffic. You can manage cookie preferences through your browser settings.

4. Sharing Your Information
We do not sell or rent your personal information. We may share your data with:
• Shipping Partners: To deliver your orders.
• Payment Processors: To securely process transactions.
• Analytics Providers: To understand website usage (data is anonymized where possible).
• Legal Authorities: If required by law or to protect our rights.

5. Data Security
We implement reasonable security measures to protect your personal information from unauthorized access, alteration, or disclosure. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.

6. Your Rights
You have the right to:
• Access the personal data we hold about you.
• Request correction of inaccurate information.
• Request deletion of your personal data (subject to legal obligations).
• Opt out of promotional communications at any time.
To exercise any of these rights, please ${contact}.

7. Third-Party Links
Our website may contain links to external sites. We are not responsible for the privacy practices or content of those websites. We encourage you to review their privacy policies.

8. Children's Privacy
Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children.

9. Changes to This Policy
We may update this Privacy Policy from time to time. Any changes will be posted on this page. Continued use of our website after updates constitutes your acceptance of the revised policy.

10. Contact Us
If you have any questions or concerns about this Privacy Policy, please ${contact}.${address ? `\n\nAddress: ${address}` : ""}`;
}

export function getDefaultTerms(store: StoreInfo): string {
  const contact = contactLine(store);
  const address = addressLine(store);
  const jurisdiction = store.city || store.state || "the applicable jurisdiction";

  return `Welcome to ${store.name}. By accessing or using our website and services, you agree to be bound by the following terms and conditions. Please read them carefully.

1. Acceptance of Terms
By placing an order or browsing our store, you confirm that you are at least 18 years of age (or have parental consent) and agree to comply with these Terms & Conditions. If you do not agree, please do not use our services.

2. Products & Pricing
• All product descriptions, images, and prices are provided in good faith and are as accurate as possible.
• We reserve the right to modify prices, discontinue products, or correct errors at any time without prior notice.
• Prices are inclusive of applicable taxes unless stated otherwise.

3. Orders & Payments
• Placing an order constitutes an offer to purchase. We reserve the right to accept or decline any order.
• Payment must be completed at the time of purchase unless otherwise agreed (e.g., Cash on Delivery where available).
• We use secure third-party payment processors and do not store your payment card details.

4. Shipping & Delivery
Shipping timelines and charges are outlined on our Shipping Policy page. Delivery dates are estimates and not guaranteed. ${store.name} is not liable for delays caused by courier services or unforeseen circumstances.

5. Returns, Refunds & Cancellations
Please refer to our Return, Refund & Cancellation Policy for full details on eligibility, process, and timelines.

6. Intellectual Property
All content on this website — including text, images, logos, graphics, and design — is the property of ${store.name} and is protected by applicable intellectual property laws. You may not reproduce, distribute, or use any content without our prior written consent.

7. User Conduct
• You agree not to use our website for any unlawful or prohibited purpose.
• You must not attempt to gain unauthorized access to our systems or interfere with website functionality.
• Any information you provide must be accurate and truthful.

8. Limitation of Liability
To the fullest extent permitted by law, ${store.name} shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our website or products. Our total liability shall not exceed the amount paid by you for the specific order in question.

9. Third-Party Links
Our website may contain links to third-party websites. We are not responsible for the content, privacy practices, or terms of those sites.

10. Changes to Terms
We reserve the right to update these Terms & Conditions at any time. Changes will be effective immediately upon posting on this page. Continued use of our services after changes constitutes your acceptance of the revised terms.

11. Governing Law
These terms are governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in ${jurisdiction}.

12. Contact Us
If you have any questions about these Terms & Conditions, please ${contact}.${address ? `\n\nAddress: ${address}` : ""}`;
}

export function getDefaultAboutUs(store: StoreInfo): string {
  const address = addressLine(store);
  const founder = (store.owner_name || "").trim();
  const founderLine = founder ? `Founded by ${founder}\n\n` : "";

  const body = store.description
    ? store.description
    : `Welcome to ${store.name}! We are passionate about bringing you the best products with exceptional quality and service. Our commitment is to make your shopping experience seamless and enjoyable.`;

  return `About ${store.name}\n\n${founderLine}${body}${address ? `\n\nOur Location: ${address}` : ""}`;
}

export function getDefaultContent(pageType: string, store: StoreInfo): string {
  switch (pageType) {
    case "return_policy": return getDefaultReturnPolicy(store);
    case "shipping_policy": return getDefaultShippingPolicy(store);
    case "privacy_policy": return getDefaultPrivacyPolicy(store);
    case "terms": return getDefaultTerms(store);
    case "about_us": return getDefaultAboutUs(store);
    default: return "";
  }
}
