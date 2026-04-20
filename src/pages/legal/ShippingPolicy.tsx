import LegalLayout from "./LegalLayout";

const ShippingPolicy = () => (
  <LegalLayout title="Shipping & Delivery Policy">
    <h2>1. Nature of Service</h2>
    <p>ShopBanao is a Software-as-a-Service (SaaS) platform. We provide digital access to our store-building software via the internet. <strong>No physical goods are shipped by ShopBanao.</strong></p>

    <h2>2. Service Activation (Digital Delivery)</h2>
    <ul>
      <li>Upon successful payment of your subscription, your account is activated <strong>instantly</strong>.</li>
      <li>You will receive an email confirmation with login details and access to your dashboard at <a href="https://shopbanao.in">https://shopbanao.in</a>.</li>
      <li>If you do not receive activation within 30 minutes, please check your spam folder or contact support.</li>
    </ul>

    <h2>3. Service Availability</h2>
    <p>The ShopBanao platform is available 24/7 globally, subject to scheduled maintenance and unforeseen downtime. We target 99.5% uptime.</p>

    <h2>4. Shipping for Merchant Stores</h2>
    <p>Each merchant who uses ShopBanao to operate their own store is independently responsible for shipping their physical products to their customers. ShopBanao does not handle, fulfill, or ship orders placed on merchant stores. Please refer to the individual merchant's shipping policy.</p>

    <h2>5. Contact</h2>
    <p>For questions about service activation:<br/>Email: shopbanaoofficial@gmail.com<br/>Phone/WhatsApp: +91 96922 82485</p>
  </LegalLayout>
);

export default ShippingPolicy;
