import { useOutletContext } from "react-router-dom";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";

export default function StorefrontPrivacyPolicy() {
  const store = useOutletContext<StoreData>();
  const name = store.name;
  const ownerEmail = ((store as any).owner_email as string | undefined)?.trim();
  const contact = store.whatsapp_number
    ? `WhatsApp us at ${store.whatsapp_number}`
    : ownerEmail
      ? `email us at ${ownerEmail}`
      : "contact us through our Contact page";
  const address = [store.location, store.city, store.state].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to={storefrontPath(store.slug)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to store
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-foreground">Privacy Policy</h1>

      <div className="prose prose-sm max-w-none text-muted-foreground">
        <p>
          At <strong>{name}</strong>, we value your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you visit or make a purchase from our store.
        </p>

        <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
        <p>We may collect the following types of information:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Personal Information:</strong> Name, email address, phone number, shipping and billing address when you place an order or contact us.</li>
          <li><strong>Payment Information:</strong> Payment details are processed securely by third-party payment gateways. We do not store your card or bank details.</li>
          <li><strong>Browsing Data:</strong> IP address, browser type, device information, pages visited, and time spent on our website (collected automatically via cookies and analytics tools).</li>
          <li><strong>Communication Data:</strong> Messages or inquiries you send us via WhatsApp, email, or our contact form.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">2. How We Use Your Information</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>To process and fulfill your orders, including shipping and payment.</li>
          <li>To communicate with you about your orders, inquiries, and customer support.</li>
          <li>To improve our website, products, and customer experience.</li>
          <li>To send promotional offers or updates (only if you have opted in; you can unsubscribe at any time).</li>
          <li>To comply with legal obligations and prevent fraud.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">3. Cookies &amp; Tracking</h2>
        <p>
          Our website may use cookies and similar technologies to enhance your browsing experience, remember your preferences, and analyze website traffic. You can manage cookie preferences through your browser settings.
        </p>

        <h2 className="text-lg font-semibold text-foreground">4. Sharing Your Information</h2>
        <p>We do not sell or rent your personal information. We may share your data with:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Shipping Partners:</strong> To deliver your orders.</li>
          <li><strong>Payment Processors:</strong> To securely process transactions.</li>
          <li><strong>Analytics Providers:</strong> To understand website usage (data is anonymized where possible).</li>
          <li><strong>Legal Authorities:</strong> If required by law or to protect our rights.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">5. Data Security</h2>
        <p>
          We implement reasonable security measures to protect your personal information from unauthorized access, alteration, or disclosure. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2 className="text-lg font-semibold text-foreground">6. Your Rights</h2>
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate information.</li>
          <li>Request deletion of your personal data (subject to legal obligations).</li>
          <li>Opt out of promotional communications at any time.</li>
        </ul>
        <p>To exercise any of these rights, please {contact}.</p>

        <h2 className="text-lg font-semibold text-foreground">7. Third-Party Links</h2>
        <p>
          Our website may contain links to external sites. We are not responsible for the privacy practices or content of those websites. We encourage you to review their privacy policies.
        </p>

        <h2 className="text-lg font-semibold text-foreground">8. Children's Privacy</h2>
        <p>
          Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children.
        </p>

        <h2 className="text-lg font-semibold text-foreground">9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Any changes will be posted on this page. Continued use of our website after updates constitutes your acceptance of the revised policy.
        </p>

        <h2 className="text-lg font-semibold text-foreground">10. Contact Us</h2>
        <p>
          If you have any questions or concerns about this Privacy Policy, please {contact}.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Store:</strong> {name}</li>
          {ownerEmail && (
            <li>
              <strong>Email:</strong>{" "}
              <a href={`mailto:${ownerEmail}`} className="underline text-foreground hover:text-primary">{ownerEmail}</a>
            </li>
          )}
          {store.whatsapp_number && (
            <li>
              <strong>Phone / WhatsApp:</strong>{" "}
              <a href={`tel:${store.whatsapp_number.replace(/[^0-9+]/g, "")}`} className="underline text-foreground hover:text-primary">{store.whatsapp_number}</a>
            </li>
          )}
          {address && (
            <li><strong>Address:</strong> {address}</li>
          )}
        </ul>
      </div>
    </div>
  );
}
