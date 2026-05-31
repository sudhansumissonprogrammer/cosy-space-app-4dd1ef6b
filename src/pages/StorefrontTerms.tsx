import { useOutletContext } from "react-router-dom";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";

export default function StorefrontTerms() {
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

      <h1 className="mb-6 text-2xl font-bold text-foreground">Terms &amp; Conditions</h1>

      <div className="prose prose-sm max-w-none text-muted-foreground">
        <p>
          Welcome to <strong>{name}</strong>. By accessing or using our website and services, you agree to be bound by the following terms and conditions. Please read them carefully.
        </p>

        <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
        <p>
          By placing an order or browsing our store, you confirm that you are at least 18 years of age (or have parental consent) and agree to comply with these Terms &amp; Conditions. If you do not agree, please do not use our services.
        </p>

        <h2 className="text-lg font-semibold text-foreground">2. Products &amp; Pricing</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>All product descriptions, images, and prices are provided in good faith and are as accurate as possible.</li>
          <li>We reserve the right to modify prices, discontinue products, or correct errors at any time without prior notice.</li>
          <li>Prices are inclusive of applicable taxes unless stated otherwise.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">3. Orders &amp; Payments</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Placing an order constitutes an offer to purchase. We reserve the right to accept or decline any order.</li>
          <li>Payment must be completed at the time of purchase unless otherwise agreed (e.g., Cash on Delivery where available).</li>
          <li>We use secure third-party payment processors and do not store your payment card details.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">4. Shipping &amp; Delivery</h2>
        <p>
          Shipping timelines and charges are outlined on our Shipping Policy page. Delivery dates are estimates and not guaranteed. {name} is not liable for delays caused by courier services or unforeseen circumstances.
        </p>

        <h2 className="text-lg font-semibold text-foreground">5. Returns, Refunds &amp; Cancellations</h2>
        <p>
          Please refer to our <Link to={storefrontPath(store.slug, "return-policy")} className="underline text-foreground hover:text-primary">Return, Refund &amp; Cancellation Policy</Link> for full details on eligibility, process, and timelines.
        </p>

        <h2 className="text-lg font-semibold text-foreground">6. Intellectual Property</h2>
        <p>
          All content on this website — including text, images, logos, graphics, and design — is the property of <strong>{name}</strong> and is protected by applicable intellectual property laws. You may not reproduce, distribute, or use any content without our prior written consent.
        </p>

        <h2 className="text-lg font-semibold text-foreground">7. User Conduct</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>You agree not to use our website for any unlawful or prohibited purpose.</li>
          <li>You must not attempt to gain unauthorized access to our systems or interfere with website functionality.</li>
          <li>Any information you provide must be accurate and truthful.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
        <p>
          To the fullest extent permitted by law, <strong>{name}</strong> shall not be liable for any indirect, incidental, special, or consequential damages arising from the use of our website or products. Our total liability shall not exceed the amount paid by you for the specific order in question.
        </p>

        <h2 className="text-lg font-semibold text-foreground">9. Third-Party Links</h2>
        <p>
          Our website may contain links to third-party websites. We are not responsible for the content, privacy practices, or terms of those sites.
        </p>

        <h2 className="text-lg font-semibold text-foreground">10. Changes to Terms</h2>
        <p>
          We reserve the right to update these Terms &amp; Conditions at any time. Changes will be effective immediately upon posting on this page. Continued use of our services after changes constitutes your acceptance of the revised terms.
        </p>

        <h2 className="text-lg font-semibold text-foreground">11. Governing Law</h2>
        <p>
          These terms are governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts in {store.city || store.state || "the applicable jurisdiction"}.
        </p>

        <h2 className="text-lg font-semibold text-foreground">12. Contact Us</h2>
        <p>
          If you have any questions about these Terms &amp; Conditions, please {contact}.
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
