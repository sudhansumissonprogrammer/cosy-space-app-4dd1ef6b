import LegalLayout from "./LegalLayout";

const PrivacyPolicy = () => (
  <LegalLayout title="Privacy Policy">
    <p>ShopBanao ("we", "our", "us") operates the website <a href="https://shopbanao.in">https://shopbanao.in</a> and provides a SaaS platform that enables merchants in India to create and manage their own online stores. This Privacy Policy explains what information we collect, how we use it, and the choices available to you.</p>

    <h2>1. Information We Collect</h2>
    <ul>
      <li><strong>Account information:</strong> name, email address, phone number, password (stored hashed).</li>
      <li><strong>Store information:</strong> business name, address, GSTIN (if provided), logo, product catalog, and orders received on your storefront.</li>
      <li><strong>Wallet & billing information:</strong> wallet recharge amounts, transaction IDs, and commission deductions. Wallet top-ups are processed by Cashfree; we do not store full card or bank account numbers on our servers.</li>
      <li><strong>Merchant payment gateway keys:</strong> if you connect Razorpay, Cashfree, PayU, or UPI for your storefront, your API credentials are stored encrypted and used only to process orders on your behalf.</li>
      <li><strong>Usage data:</strong> IP address, browser type, device information, pages visited, and timestamps.</li>
      <li><strong>Cookies:</strong> used for authentication, preferences, and analytics.</li>
    </ul>

    <h2>2. How We Use Your Information</h2>
    <ul>
      <li>To create and operate your ShopBanao account and storefront.</li>
      <li>To deduct platform commission from your wallet on confirmed orders and to issue wallet recharge receipts.</li>
      <li>To provide customer support and respond to inquiries.</li>
      <li>To send service updates, security alerts, and (with consent) marketing communications.</li>
      <li>To detect, prevent, and address fraud or abuse.</li>
      <li>To comply with legal obligations under Indian law.</li>
    </ul>

    <h2>3. Sharing of Information</h2>
    <p>We do not sell your personal information. We share data only with:</p>
    <ul>
      <li><strong>Payment processors:</strong> Cashfree for wallet recharges; and the merchant's own gateway (Razorpay / Cashfree / PayU) for storefront orders.</li>
      <li><strong>Infrastructure providers:</strong> hosting, database, edge CDN, email, and WhatsApp messaging — bound by confidentiality.</li>
      <li><strong>Law enforcement:</strong> when required by valid legal process.</li>
    </ul>

    <h2>4. Data Security</h2>
    <p>We use HTTPS encryption in transit, password hashing, row-level access controls in our database, and encrypted secret storage for merchant gateway credentials. No system is 100% secure, but we work to follow industry-standard practices.</p>

    <h2>5. Data Retention</h2>
    <p>We retain your account data as long as your account is active. After account closure, we retain transactional and tax records (wallet recharges, commission invoices, orders) for up to 7 years to comply with Indian tax and accounting laws.</p>

    <h2>6. Your Rights</h2>
    <p>You may request access, correction, or deletion of your personal data by emailing <a href="mailto:sudhansusahoo313@gmail.com">sudhansusahoo313@gmail.com</a>. We will respond within 30 days. Deletion requests do not override our retention obligations for tax and accounting records.</p>

    <h2>7. Children's Privacy</h2>
    <p>ShopBanao is not intended for users under the age of 18. We do not knowingly collect data from minors.</p>

    <h2>8. Changes to This Policy</h2>
    <p>We may update this policy from time to time. Material changes will be notified via email or in-app notice.</p>

    <h2>9. Contact</h2>
    <p>ShopBanao<br/>Email: <a href="mailto:sudhansusahoo313@gmail.com">sudhansusahoo313@gmail.com</a><br/>Phone / WhatsApp: <a href="https://wa.me/919692282485">+91 96922 82485</a></p>
  </LegalLayout>
);

export default PrivacyPolicy;
