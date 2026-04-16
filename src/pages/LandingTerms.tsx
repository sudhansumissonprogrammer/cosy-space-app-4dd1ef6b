import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

export default function LandingTerms() {
  return (
    <div className="min-h-screen bg-background font-outfit">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>

        <h1 className="mb-8 text-3xl font-bold text-foreground">Terms & Conditions</h1>

        <div className="prose prose-sm max-w-none text-muted-foreground space-y-6">
          <p className="text-base">
            <strong>Effective Date:</strong> April 16, 2026
          </p>
          <p>
            Welcome to <strong>ShopBanao</strong>. By accessing or using our website <strong>shopbanao.in</strong> and our ecommerce store-building services, you agree to be bound by the following terms and conditions. Please read them carefully.
          </p>

          <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By using our platform, signing up for an account, or purchasing our services, you confirm that you are at least 18 years of age and agree to comply with these Terms & Conditions. If you do not agree, please do not use our services.
          </p>

          <h2 className="text-lg font-semibold text-foreground">2. Services Provided</h2>
          <p>ShopBanao provides the following services:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Professional ecommerce website building and design.</li>
            <li>Custom domain setup and SSL configuration.</li>
            <li>Payment gateway integration (UPI, Cards, COD via Razorpay).</li>
            <li>Product catalog management with unlimited products.</li>
            <li>WhatsApp order notifications and marketing tools.</li>
            <li>SEO optimization and analytics.</li>
            <li>Ongoing technical support and maintenance.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">3. Account Registration</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You must provide accurate and complete information during registration.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>You are responsible for all activities that occur under your account.</li>
            <li>ShopBanao reserves the right to suspend or terminate accounts that violate these terms.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">4. Payments & Refunds</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>All service fees are communicated before purchase and must be paid in full to activate services.</li>
            <li>Payments are processed securely through third-party payment gateways.</li>
            <li>Refunds may be considered on a case-by-case basis within 7 days of purchase if the store has not been delivered or published. Once a store is live, refunds are not applicable.</li>
            <li>Domain registration fees are non-refundable.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">5. Store Content & Responsibility</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You are solely responsible for the products, descriptions, images, and content you publish on your store.</li>
            <li>You must ensure your products comply with all applicable Indian laws and regulations.</li>
            <li>ShopBanao does not endorse or verify the products sold through stores built on our platform.</li>
            <li>You must not use the platform to sell prohibited, illegal, or counterfeit goods.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">6. Intellectual Property</h2>
          <p>
            All ShopBanao platform code, design, logos, and branding are the intellectual property of ShopBanao and are protected by applicable intellectual property laws. You may not reproduce, distribute, or use any ShopBanao assets without our prior written consent.
          </p>
          <p>
            Content you upload to your store (product images, descriptions, logos) remains your property. By uploading, you grant ShopBanao a limited license to display and deliver this content as part of our service.
          </p>

          <h2 className="text-lg font-semibold text-foreground">7. Prohibited Activities</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Using the platform for any unlawful or fraudulent purpose.</li>
            <li>Attempting to gain unauthorized access to our systems or other users' accounts.</li>
            <li>Distributing malware, viruses, or harmful code through the platform.</li>
            <li>Scraping, data mining, or automated extraction of data from our platform.</li>
            <li>Reselling or sublicensing ShopBanao services without authorization.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">8. Service Availability & Uptime</h2>
          <p>
            We strive to maintain 99.9% uptime for all stores hosted on our platform. However, we do not guarantee uninterrupted service and are not liable for temporary outages due to maintenance, server issues, or circumstances beyond our control.
          </p>

          <h2 className="text-lg font-semibold text-foreground">9. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, ShopBanao shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our platform. This includes but is not limited to loss of profits, data, or business opportunities. Our total liability shall not exceed the amount paid by you for the specific service in question.
          </p>

          <h2 className="text-lg font-semibold text-foreground">10. Termination</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>You may request account termination at any time by contacting us.</li>
            <li>ShopBanao reserves the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or remain inactive for an extended period.</li>
            <li>Upon termination, your store data will be retained for 30 days before permanent deletion.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">11. Third-Party Services</h2>
          <p>
            Our platform integrates with third-party services including Razorpay (payments), WhatsApp Business API, and domain registrars. Your use of these services is subject to their respective terms and privacy policies. ShopBanao is not responsible for third-party service interruptions.
          </p>

          <h2 className="text-lg font-semibold text-foreground">12. Governing Law & Disputes</h2>
          <p>
            These terms are governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in Odisha, India.
          </p>

          <h2 className="text-lg font-semibold text-foreground">13. Changes to Terms</h2>
          <p>
            We reserve the right to update these Terms & Conditions at any time. Changes will be effective immediately upon posting on this page. Continued use of our services after changes constitutes your acceptance of the revised terms.
          </p>

          <h2 className="text-lg font-semibold text-foreground">14. Contact Us</h2>
          <p>If you have any questions about these Terms & Conditions, please contact us:</p>
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
