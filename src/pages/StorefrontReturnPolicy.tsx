import { useOutletContext } from "react-router-dom";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";

function DefaultReturnPolicy({ store }: { store: StoreData }) {
  const name = store.name;
  const contact = store.whatsapp_number
    ? `WhatsApp us at ${store.whatsapp_number}`
    : "contact us through our Contact page";

  return (
    <div className="prose prose-sm max-w-none text-muted-foreground">
      <h2 className="text-lg font-semibold text-foreground">Return & Refund Policy</h2>
      <p>
        At <strong>{name}</strong>, we want you to be completely satisfied with your purchase. If you're not happy with your order, we're here to help.
      </p>

      <h3 className="text-base font-semibold text-foreground">Eligibility</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Items must be returned within <strong>7 days</strong> of delivery.</li>
        <li>Products must be unused, unwashed, and in original packaging with all tags attached.</li>
        <li>Proof of purchase (order confirmation or receipt) is required.</li>
      </ul>

      <h3 className="text-base font-semibold text-foreground">Non-Returnable Items</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Perishable goods (food, flowers, etc.)</li>
        <li>Intimate or sanitary products</li>
        <li>Customized or personalized items</li>
        <li>Gift cards and downloadable products</li>
        <li>Items marked as "Final Sale"</li>
      </ul>

      <h3 className="text-base font-semibold text-foreground">Refund Process</h3>
      <ol className="list-decimal pl-5 space-y-1">
        <li>Initiate a return by contacting us — {contact}.</li>
        <li>We'll provide return instructions and a return authorization.</li>
        <li>Ship the item back to us (return shipping may apply).</li>
        <li>Once received and inspected, your refund will be processed within <strong>5–7 business days</strong>.</li>
      </ol>

      <h3 className="text-base font-semibold text-foreground">Exchanges</h3>
      <p>
        If you received a defective or damaged item, please {contact} immediately. We'll arrange a replacement at no extra cost.
      </p>

      <h3 className="text-base font-semibold text-foreground">Contact Us</h3>
      <p>
        For any questions about returns, please {contact}. We're happy to assist you.
      </p>
    </div>
  );
}

export default function StorefrontReturnPolicy() {
  const store = useOutletContext<StoreData>();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to={storefrontPath(store.slug)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to store
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-foreground">Return Policy</h1>

      {(store as any).return_policy ? (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {(store as any).return_policy}
        </div>
      ) : (
        <DefaultReturnPolicy store={store} />
      )}
    </div>
  );
}
