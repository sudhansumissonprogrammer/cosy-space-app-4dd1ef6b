import { useState } from "react";
import { PackageCheck, Phone, MessageCircle, PhoneCall, X } from "lucide-react";
import { waPhoneNumber } from "@/lib/phoneUtils";

interface Props {
  product: any;
  store: any;
}

const CALL_TIMING = "10 AM to 7 PM";

/** True when current IST time is within 10:00–19:00. */
function isWithinCallHoursIST(): boolean {
  const now = new Date();
  const istMinutes = (now.getTime() + 5.5 * 60 * 60 * 1000) / 60000;
  const minsOfDay = Math.floor(istMinutes) % (24 * 60);
  return minsOfDay >= 10 * 60 && minsOfDay < 19 * 60;
}

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
  const [showTiming, setShowTiming] = useState(false);

  const waPhone = waPhoneNumber(store?.whatsapp_number);
  if (!waPhone) return null;
  const telPhone = `+${waPhone}`;

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
    "flex-1 min-w-0 inline-flex items-center justify-center gap-1 px-1.5 py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide border transition-colors whitespace-nowrap";

  return (
    <section>
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
        <div className="min-w-0">
          <p
            className="text-sm sm:text-base font-semibold leading-snug"
            style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
          >
            After dispatch, track your order live on our website.
          </p>
          <p className="mt-1 text-xs sm:text-sm leading-snug text-muted-foreground">
            You also get regular WhatsApp updates — packing, dispatch, in-transit and
            out-for-delivery — till the parcel reaches your door.
          </p>
        </div>

      </div>

      {/* Actions — single row, never wrap */}
      <div className="mt-3 flex flex-nowrap gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={btn}
          style={{
            borderColor: "var(--storefront-border, hsl(var(--border)))",
            color: "var(--storefront-text, hsl(var(--foreground)))",
          }}
        >
          <PhoneCall className="h-3 w-3 shrink-0" aria-hidden="true" />
          Request Call
        </button>
        <a
          href={`tel:${telPhone}`}
          onClick={(e) => {
            if (!isWithinCallHoursIST()) {
              e.preventDefault();
              setShowTiming(true);
            }
          }}
          className={btn}
          style={{
            borderColor: "var(--storefront-border, hsl(var(--border)))",
            color: "var(--storefront-text, hsl(var(--foreground)))",
          }}
        >
          <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
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
          <MessageCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          WhatsApp Now
        </a>
      </div>

      {/* Shown only when someone taps Call Now outside calling hours */}
      {showTiming && (
        <div className="mt-3">
          <p className="text-xs sm:text-sm font-semibold" style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}>
            Call timing: {CALL_TIMING}
          </p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Our calling time is {CALL_TIMING}. You can request a call instead. Thank you.
          </p>
          <button
            type="button"
            onClick={() => { setShowTiming(false); setOpen(true); }}
            className="mt-2 text-xs font-bold uppercase tracking-wide underline"
            style={{ color: "var(--storefront-primary, hsl(var(--primary)))" }}
          >
            Request a call back
          </button>
        </div>
      )}

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
