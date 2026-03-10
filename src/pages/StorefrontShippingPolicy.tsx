import { useOutletContext } from "react-router-dom";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";

function DefaultShippingPolicy({ store }: { store: StoreData }) {
  const name = store.name;
  const contact = store.whatsapp_number
    ? `WhatsApp us at ${store.whatsapp_number}`
    : "contact us through our Contact page";
  const area = [store.city, store.state].filter(Boolean).join(", ");

  return (
    <div className="prose prose-sm max-w-none text-muted-foreground">
      <h2 className="text-lg font-semibold text-foreground">Shipping Policy</h2>
      <p>
        Thank you for shopping at <strong>{name}</strong>! Here's everything you need to know about our shipping process.
      </p>

      <h3 className="text-base font-semibold text-foreground">Processing Time</h3>
      <p>
        Orders are processed within <strong>1–3 business days</strong> after payment confirmation. Orders placed on weekends or holidays will be processed the next business day.
      </p>

      <h3 className="text-base font-semibold text-foreground">Shipping Areas</h3>
      <p>
        We currently ship {area ? `from ${area} ` : ""}across India. International shipping availability varies by product — please {contact} for details.
      </p>

      <h3 className="text-base font-semibold text-foreground">Delivery Estimates</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li><strong>Local delivery{area ? ` (${area})` : ""}:</strong> 1–3 business days</li>
        <li><strong>Domestic (rest of India):</strong> 5–7 business days</li>
        <li><strong>Remote areas:</strong> 7–10 business days</li>
      </ul>
      <p className="text-xs">Delivery times are estimates and may vary due to external factors.</p>

      <h3 className="text-base font-semibold text-foreground">Shipping Costs</h3>
      <p>
        Shipping charges are calculated at checkout based on your delivery location and order weight. We may offer free shipping on orders above a certain amount — check the store for current offers.
      </p>

      <h3 className="text-base font-semibold text-foreground">Order Tracking</h3>
      <p>
        Once your order is shipped, you'll receive a tracking number via WhatsApp or email. You can use it to track your package with the courier partner.
      </p>

      <h3 className="text-base font-semibold text-foreground">Damaged or Lost Packages</h3>
      <p>
        If your package arrives damaged or doesn't arrive within the estimated timeframe, please {contact}. We'll investigate and resolve the issue promptly.
      </p>

      <h3 className="text-base font-semibold text-foreground">Contact Us</h3>
      <p>
        For shipping inquiries, please {contact}. We're here to help!
      </p>
    </div>
  );
}

export default function StorefrontShippingPolicy() {
  const store = useOutletContext<StoreData>();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        to={storefrontPath(store.slug)}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to store
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-foreground">Shipping Policy</h1>

      {(store as any).shipping_policy ? (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {(store as any).shipping_policy}
        </div>
      ) : (
        <DefaultShippingPolicy store={store} />
      )}
    </div>
  );
}
