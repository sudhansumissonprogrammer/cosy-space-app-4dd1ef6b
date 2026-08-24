import { useState } from "react";
import { PackageCheck, Phone, MessageCircle, PhoneCall, X } from "lucide-react";

interface Props {
  product: any;
  store: any;
}

const CALL_TIMING = "10 AM to 7 PM";

/**
 * "Before dispatch we send your parcel packaging on WhatsApp" trust block
 * plus three contact actions (Request Call / Call Now / WhatsApp Now).
 *
 * Fully client-side: Request Call collects a number and hands it to the
 * store's WhatsApp with a pre-filled callback request — no backend needed.
 */
export default function ParcelAssuranceSection({ product, store }: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const raw = String(store?.whatsapp_number || "").replace(/[^0-9]/g, "");
  if (!raw) return null;
  const waPhone = raw.length === 10 ? `91${raw}` : raw;
  const telPhone = raw.length === 10 ? `+91${raw}` : `+${waPhone}`;

  const productLine = product?.name ? `\n\nProduct: ${product.name}` : "";

  const waHref = `https://wa.me/${waPhone}?text=${encodeURIComponent(
    `Hi ${store?.name || ""}! I have a question about this product.${productLine}`,
  )}`;

  const submitCallback = () => {
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setError("");
    setOpen(false);
    const text = `Hi ${store?.name || ""}, please call me back on +91${digits}.\nCall timing: ${CALL_TIMING}${productLine}`;
    window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };

  const btn =
    "flex-1 min-w-[30%] inline-flex items-center justify-center gap-1.5 px-2.5 py-3 text-[11px] sm:text-xs font-bold uppercase tracking-wide border transition-colors";

  return (
    <section className="mt-6">
      {/* Assurance strip */}
      <div
        className="flex items-start gap-3 rounded-sm border-l-4 p-3.5 sm:p-4"
        style={{
          borderLeftColor: "var(--storefront-primary, hsl(var(--primary)))",
          background: "var(--storefront-muted, hsl(var(--muted)))",
        }}
      >
        <PackageCheck
          className="h-5 w-5 shrink-0 mt-0.5"
          style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}
          aria-hidden="true"
        />
        <p
          className="text-sm sm:text-base font-semibold leading-snug"
          style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
        >
          Before dispatch, we send your parcel packaging on WhatsApp.
        </p>
      </div>

      {/* Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={btn}
          style={{
            borderColor: "var(--storefront-border, hsl(var(--border)))",
            color: "var(--storefront-text, hsl(var(--foreground)))",
          }}
        >
          <PhoneCall className="h-3.5 w-3.5" aria-hidden="true" />
          Request Call
        </button>
        <a
          href={`tel:${telPhone}`}
          className={btn}
          style={{
            borderColor: "var(--storefront-border, hsl(var(--border)))",
            color: "var(--storefront-text, hsl(var(--foreground)))",
          }}
        >
          <Phone className="h-3.5 w-3.5" aria-hidden="true" />
          Call Now
        </a>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
          style={{
            borderColor: "var(--storefront-border, hsl(var(--border)))",
            color: "var(--storefront-text, hsl(var(--foreground)))",
          }}
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
          WhatsApp Now
        </a>
      </div>

      <p className="mt-3 text-xs sm:text-sm" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}>
        Call timing: {CALL_TIMING}
      </p>
      <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
        Our calling time is {CALL_TIMING}. You can request a call instead. Thank you.
      </p>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-xl bg-background p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-foreground">Request a call back</h3>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              We call between {CALL_TIMING}. Share your number and we'll reach out.
            </p>
            <input
              type="tel"
              inputMode="numeric"
              autoFocus
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCallback()}
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
            <button
              type="button"
              onClick={submitCallback}
              className="mt-3 w-full rounded-md bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              Request Call
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
