import LegalLayout from "./LegalLayout";

const PrivacyPolicy = () => (
  <LegalLayout title="Privacy Policy">
    <p>ShopBanao ("we", "our", "us") operates the website <a href="https://shopbanao.in">https://shopbanao.in</a> and provides a SaaS platform that enables merchants to create and manage their own online stores. This Privacy Policy explains how we collect, use, and protect your information.</p>

    <h2>1. Information We Collect</h2>
    <ul>
      <li><strong>Account information:</strong> name, email address, phone number, password (hashed).</li>
      <li><strong>Store information:</strong> business name, address, GSTIN (if provided), logo, products, and orders.</li>
      <li><strong>Payment information:</strong> processed securely via Razorpay. We do not store full card or banking details on our servers.</li>
      <li><strong>Usage data:</strong> IP address, browser type, device information, pages visited, and timestamps.</li>
      <li><strong>Cookies:</strong> used for authentication, preferences, and analytics.</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To create and operate your ShopBanao account and storefront.</li>
      <li>To process subscription payments and send invoices.</li>
      <li>To provide customer support and respond to inquiries.</li>
      <li>To send service updates, security alerts, and (with consent) marketing communications.</li>
      <li>To detect, prevent, and address fraud or abuse.</li>
      <li>To comply with legal obligations under Indian law.</li>
    </ul>

    <h2>3. Sharing of Information</h2>
    <p>We do not sell your personal information. We share data only with:</p>
    <ul>
      <li><strong>Payment processors</strong> (Razorpay) to process subscription payments.</li>
      <li><strong>Infrastructure providers</strong> (hosting, database, email) under strict confidentiality.</li>
      <li><strong>Law enforcement</strong> when required by valid legal process.</li>
    </ul>

    <h2>4. Data Security</h2>
    <p>We implement industry-standard security measures including HTTPS encryption, password hashing, role-based access controls, and regular security audits. However, no system is 100% secure.</p>

    <h2>5. Data Retention</h2>
    <p>We retain your account data as long as your account is active. After account closure, we retain transactional records for up to 7 years to comply with Indian tax and accounting laws.</p>

    <h2>6. Your Rights</h2>
    <p>You may request access, correction, or deletion of your personal data by emailing sudhansusahoo313@gmail.com. We will respond within 30 days.</p>

    <h2>7. Children's Privacy</h2>
    <p>ShopBanao is not intended for users under the age of 18. We do not knowingly collect data from minors.</p>

    <h2>8. Changes to This Policy</h2>
    <p>We may update this policy from time to time. Material changes will be notified via email or in-app notice.</p>

    <h2>9. Contact</h2>
    <p>ShopBanao<br/>Email: sudhansusahoo313@gmail.com<br/>Phone/WhatsApp: +91 96922 82485</p>
  </LegalLayout>
);

export default PrivacyPolicy;
