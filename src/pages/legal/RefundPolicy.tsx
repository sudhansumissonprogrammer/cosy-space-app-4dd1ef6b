import LegalLayout from "./LegalLayout";

const RefundPolicy = () => (
  <LegalLayout title="Refund & Cancellation Policy">
    <p>This Refund & Cancellation Policy applies to subscription payments made to ShopBanao for use of our SaaS platform.</p>

    <h2>1. Subscription Cancellation</h2>
    <ul>
      <li>You may cancel your subscription at any time from your dashboard or by emailing shopbanaoofficial@gmail.com.</li>
      <li>Upon cancellation, your account will remain active until the end of the current billing period.</li>
      <li>You will not be charged for subsequent billing cycles after cancellation.</li>
    </ul>

    <h2>2. Refund Eligibility</h2>
    <p>Because ShopBanao is a digital SaaS service, all subscription payments are generally non-refundable. However, we offer refunds in the following limited cases:</p>
    <ul>
      <li><strong>7-day money-back guarantee</strong> on first-time monthly and yearly subscriptions if you have not actively used the platform (no products published, no orders received).</li>
      <li><strong>Duplicate payment:</strong> if you are accidentally charged twice for the same subscription, the duplicate amount will be refunded in full.</li>
      <li><strong>Service failure:</strong> if ShopBanao experiences extended downtime (more than 72 continuous hours) attributable to us, a pro-rata refund may be issued.</li>
    </ul>

    <h2>3. Non-Refundable Items</h2>
    <ul>
      <li>Lifetime plans after 7 days of purchase.</li>
      <li>Add-ons or one-time service fees once delivered.</li>
      <li>Subscription periods already used.</li>
      <li>Custom domain registration fees paid to third parties.</li>
    </ul>

    <h2>4. Refund Process</h2>
    <ul>
      <li>To request a refund, email shopbanaoofficial@gmail.com with your registered email, payment ID, and reason.</li>
      <li>Approved refunds are processed within <strong>5–7 business days</strong> via the original payment method through Razorpay.</li>
      <li>Bank processing may take an additional 3–5 business days to reflect in your account.</li>
    </ul>

    <h2>5. Chargebacks</h2>
    <p>We encourage you to contact us first to resolve any billing concerns. Initiating a chargeback without contacting us may result in immediate account suspension.</p>

    <h2>6. Contact</h2>
    <p>For refund or cancellation inquiries:<br/>Email: shopbanaoofficial@gmail.com<br/>Phone/WhatsApp: +91 96922 82485</p>
  </LegalLayout>
);

export default RefundPolicy;
