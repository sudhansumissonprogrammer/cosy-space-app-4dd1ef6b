import { useOutletContext } from "react-router-dom";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { kalingaPublicAddress } from "@/lib/kalingaStore";

function DefaultPolicy({ store }: { store: StoreData }) {
  const name = store.name;
  const contact = store.whatsapp_number
    ? `WhatsApp us at ${store.whatsapp_number}`
    : "contact us through our Contact page";
  const address = kalingaPublicAddress(store) ?? [store.location, store.city, store.state].filter(Boolean).join(", ");

  return (
    <div className="prose prose-sm max-w-none text-muted-foreground">
      <p>
        At <strong>{name}</strong>, customer satisfaction is our top priority. Please read our complete Return, Refund &amp; Cancellation policy below.
      </p>

      {/* ── CANCELLATION ── */}
      <h2 className="text-lg font-semibold text-foreground">Order Cancellation</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Orders can be cancelled before they are shipped or dispatched.</li>
        <li>To cancel an order, {contact} with your order details as soon as possible.</li>
        <li>Once an order has been shipped, it cannot be cancelled — you may initiate a return instead.</li>
        <li>If payment was already collected, the full amount will be refunded to the original payment method within <strong>5–7 business days</strong> of cancellation confirmation.</li>
      </ul>

      {/* ── RETURNS ── */}
      <h2 className="text-lg font-semibold text-foreground">Returns</h2>
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

      <h3 className="text-base font-semibold text-foreground">How to Initiate a Return</h3>
      <ol className="list-decimal pl-5 space-y-1">
        <li>{contact} with your order number and reason for return.</li>
        <li>We'll provide return instructions and a return authorization.</li>
        <li>Pack the item securely and ship it back (return shipping costs may apply unless the item is defective).</li>
      </ol>

      {/* ── REFUNDS ── */}
      <h2 className="text-lg font-semibold text-foreground">Refunds</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Once we receive and inspect the returned item, we will notify you of the approval or rejection of your refund.</li>
        <li>Approved refunds will be processed within <strong>5–7 business days</strong> to the original payment method.</li>
        <li>Shipping charges are non-refundable unless the return is due to our error (wrong or defective item).</li>
        <li>If you haven't received your refund after the stated period, please {contact}.</li>
      </ul>

      {/* ── EXCHANGES ── */}
      <h2 className="text-lg font-semibold text-foreground">Exchanges</h2>
      <p>
        If you received a defective or damaged item, please {contact} immediately. We'll arrange a replacement at no extra cost, subject to availability.
      </p>

      {/* ── CONTACT ── */}
      <h2 className="text-lg font-semibold text-foreground">Contact Us</h2>
      <p>
        For any questions about returns, refunds, or cancellations, please {contact}. We're happy to assist you.
      </p>
      {address && (
        <p>
          <strong>Address:</strong> {address}
        </p>
      )}
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

      <h1 className="mb-6 text-2xl font-bold text-foreground">Return, Refund &amp; Cancellation Policy</h1>

      {store.return_policy ? (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {store.return_policy}
        </div>
      ) : (
        <DefaultPolicy store={store} />
      )}
    </div>
  );
}
