/**
 * Compact exit-save popup for checkout (GoKwik / Shiprocket style).
 *
 * Deliberately small: a single-screen card that never scrolls on a 360x640
 * phone. One headline, one price proof line, two equally-clear actions.
 *
 * Styling is 100% storefront-theme driven — it inherits the merchant's
 * primary colour, button radius and fonts from the --storefront-* CSS vars
 * so it never looks like a bolted-on generic green widget.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ShieldCheck, Clock, BadgePercent } from "lucide-react";

interface Props {
  open: boolean;
  /** Headline discount, e.g. "₹100 OFF". Omit for the no-coupon reassurance variant. */
  offerLabel?: string;
  /** Coupon code being offered (shown as proof) */
  offerCode?: string;
  /** Current total before the extra saving, formatted */
  currentTotalLabel?: string;
  /** Total after claiming, formatted */
  newTotalLabel?: string;
  /** true when the offer is already on the order (claim just closes) */
  alreadyClaimed?: boolean;
  onClaim: () => void;
  onLeave: () => void;
  onClose: () => void;
}

export default function CheckoutExitOffer({
  open,
  offerLabel,
  offerCode,
  currentTotalLabel,
  newTotalLabel,
  alreadyClaimed,
  onClaim,
  onLeave,
  onClose,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(120);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(120);
    const id = window.setInterval(() => setSecondsLeft((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [open]);

  // Checkout is rendered inside PageTransition, which uses a CSS transform on
  // forward navigation. A fixed descendant of a transformed element is fixed
  // to that element instead of the viewport, so after scrolling the dialog was
  // rendered at the document top and appeared clipped off-screen on mobile.
  // Portalling to body gives the overlay a true visual-viewport containing block.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const showProof = Boolean(newTotalLabel);

  const primary = "var(--storefront-primary, hsl(var(--primary)))";
  const onPrimary = "var(--storefront-btn-text, #ffffff)";
  const radius = "var(--storefront-button-radius, 0.75rem)";
  const softTint = `color-mix(in srgb, ${primary} 9%, transparent)`;
  const softBorder = `color-mix(in srgb, ${primary} 26%, transparent)`;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center px-4 pt-[max(12px,env(safe-area-inset-top))] bg-black/45 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label="Before you leave"
      onClick={onClose}
    >
      <div
        className="sfg sfg-panel sfg-strong relative w-full max-w-[330px] overflow-hidden animate-in slide-in-from-top-2 duration-150"
        style={{
          backgroundColor: "color-mix(in srgb, var(--storefront-bg, #ffffff) 84%, transparent)",
          color: "var(--storefront-text, inherit)",
          fontFamily: "var(--storefront-body-font, inherit)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Themed top accent bar */}
        <div className="h-1 w-full" style={{ background: primary }} />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-1.5 top-2 h-7 w-7 rounded-full opacity-45 flex items-center justify-center"
          style={{ color: "var(--storefront-text, currentColor)" }}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>

        <div className="px-4 pt-3 pb-3.5">
          {offerLabel && (
            <div
              className="inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10px] font-bold uppercase tracking-wide"
              style={{ background: primary, color: onPrimary }}
            >
              <Clock className="h-2.5 w-2.5" /> {mm}:{ss} left
            </div>
          )}

          <h3
            className="mt-1.5 pr-6 text-[15.5px] font-extrabold leading-tight"
            style={{ fontFamily: "var(--storefront-heading-font, inherit)" }}
          >
            {offerLabel ? `Wait — ${offerLabel} if you order now` : "Your order isn't placed yet"}
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug opacity-60">
            {offerLabel
              ? "Valid on this order only"
              : "We're holding your items for a few minutes."}
          </p>

          {offerCode && (
            <div
              className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-dashed px-2 py-[3px] text-[10.5px] font-bold tracking-wide"
              style={{ borderColor: softBorder, color: primary, background: softTint }}
            >
              <BadgePercent className="h-3 w-3" /> {offerCode}
            </div>
          )}

          {showProof && (
            <div
              className="mt-2 flex items-baseline gap-2 rounded-lg px-2.5 py-1.5"
              style={{ background: softTint }}
            >
              {currentTotalLabel && (
                <span className="text-[11.5px] line-through opacity-55">{currentTotalLabel}</span>
              )}
              <span className="text-[17px] font-extrabold" style={{ color: primary }}>
                {newTotalLabel}
              </span>
              <span className="ml-auto text-[10px] font-semibold opacity-70">You pay</span>
            </div>
          )}

          <button
            type="button"
            onClick={onClaim}
            className="mt-2.5 w-full h-11 text-[13.5px] font-extrabold active:scale-[0.99] transition-transform"
            style={{ background: primary, color: onPrimary, borderRadius: radius }}
          >
            {alreadyClaimed || !offerLabel ? "Continue & order now" : `Claim ${offerLabel} & order`}
          </button>

          <button
            type="button"
            onClick={onLeave}
            className="mt-2 w-full h-11 text-[13px] font-bold border bg-transparent active:scale-[0.99] transition-transform"
            style={{ borderColor: softBorder, color: "var(--storefront-text, inherit)", borderRadius: radius }}
          >
            No thanks, go back
          </button>

          <div className="mt-2.5 flex items-center justify-center gap-1 text-[10px] opacity-60">
            <ShieldCheck className="h-3 w-3" style={{ color: primary }} /> 100% secure checkout
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
