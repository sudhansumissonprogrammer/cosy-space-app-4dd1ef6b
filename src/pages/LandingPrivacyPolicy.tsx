import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function LandingPrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background font-outfit">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-foreground">Privacy Policy</h1>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <p className="text-base">
            <strong>Effective Date:</strong> April 16, 2026
          </p>
          <p>
            At <strong>ShopBanao</strong> (operated by ShopBanao, India), we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website <strong>shopbanao.in</strong> or use our services.
          </p>

          <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p>We may collect the following types of information:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Personal Information:</strong> Name, email address, phone number, business name, and billing address when you sign up or contact us.</li>
            <li><strong>Store Data:</strong> Product listings, store configurations, customer orders, and analytics data generated through your use of our platform.</li>
            <li><strong>Payment Information:</strong> Payment details are processed securely by third-party payment gateways (Razorpay). We do not store your card or bank details on our servers.</li>
            <li><strong>Browsing Data:</strong> IP address, browser type, device information, pages visited, and time spent on our website (collected automatically via cookies and analytics tools).</li>
            <li><strong>Communication Data:</strong> Messages or inquiries you send us via WhatsApp, email, or our contact form.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>To create and manage your ecommerce store on our platform.</li>
            <li>To process payments and fulfill service orders.</li>
            <li>To communicate with you about your account, store, and support requests.</li>
            <li>To improve our platform, features, and customer experience.</li>
            <li>To send promotional offers or updates (only if you have opted in; you can unsubscribe at any time).</li>
            <li>To comply with legal obligations and prevent fraud.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">3. Cookies & Tracking</h2>
          <p>
            Our website uses cookies and similar technologies (including Meta Pixel and Google Analytics) to enhance your browsing experience, remember your preferences, and analyze website traffic. You can manage cookie preferences through your browser settings.
          </p>

          <h2 className="text-lg font-semibold text-foreground">4. Data Sharing & Third Parties</h2>
          <p>We do not sell or rent your personal information. We may share your data with:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Payment Processors (Razorpay):</strong> To securely process transactions.</li>
            <li><strong>Cloud Infrastructure Providers:</strong> To host and deliver our services reliably.</li>
            <li><strong>Analytics Providers:</strong> To understand website usage (data is anonymized where possible).</li>
            <li><strong>Domain Registrars:</strong> When setting up custom domains for your store.</li>
            <li><strong>Legal Authorities:</strong> If required by law or to protect our rights.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">5. Data Security</h2>
          <p>
            We implement industry-standard security measures including SSL/TLS encryption, secure authentication, and Row-Level Security on our databases to protect your personal information from unauthorized access, alteration, or disclosure. However, no method of transmission over the internet is 100% secure.
          </p>

          <h2 className="text-lg font-semibold text-foreground">6. Data Retention</h2>
          <p>
            We retain your personal data for as long as your account is active or as needed to provide our services. If you request account deletion, we will remove your data within 30 days, except where retention is required by law.
          </p>

          <h2 className="text-lg font-semibold text-foreground">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate information.</li>
            <li>Request deletion of your personal data (subject to legal obligations).</li>
            <li>Opt out of promotional communications at any time.</li>
            <li>Request a copy of your data in a portable format.</li>
          </ul>
          <p>To exercise any of these rights, please WhatsApp us at <strong>+91 96922 82485</strong> or email <strong>shopbanaoofficial@gmail.com</strong>.</p>

          <h2 className="text-lg font-semibold text-foreground">8. Children's Privacy</h2>
          <p>
            Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children.
          </p>

          <h2 className="text-lg font-semibold text-foreground">9. Third-Party Links</h2>
          <p>
            Our website may contain links to external sites. We are not responsible for the privacy practices or content of those websites.
          </p>

          <h2 className="text-lg font-semibold text-foreground">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. Continued use of our website after updates constitutes your acceptance of the revised policy.
          </p>

          <h2 className="text-lg font-semibold text-foreground">11. Contact Us</h2>
          <p>If you have any questions or concerns about this Privacy Policy, please contact us:</p>
          <ul className="list-none pl-0 space-y-1">
            <li><strong>WhatsApp:</strong> +91 96922 82485</li>
            <li><strong>Email:</strong> shopbanaoofficial@gmail.com</li>
            <li><strong>Website:</strong> shopbanao.in</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
