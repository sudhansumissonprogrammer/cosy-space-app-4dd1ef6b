/**
 * Compact exit-save popup for checkout (GoKwik / Shiprocket style).
 *
 * Deliberately small: a single-screen card that never scrolls on a 360x640
 * phone. One headline, one price proof line, two actions. No trust grid,
 * no long copy — every extra row costs conversions on the abandon moment.
 */
import { useEffect, useState } from "react";
import { X, ShieldCheck, Clock } from "lucide-react";

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

  if (!open) return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const showProof = Boolean(newTotalLabel);

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center px-4 pt-[max(12px,env(safe-area-inset-top))] bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-150 overflow-y-auto overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-label="Before you leave"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[320px] rounded-2xl bg-white shadow-2xl animate-in slide-in-from-top-2 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-1.5 top-1.5 h-7 w-7 rounded-full text-black/40 flex items-center justify-center"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>

        <div className="px-3.5 pt-3 pb-3">

          {offerLabel && (
            <div className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wide px-2 py-[3px]">
              <Clock className="h-2.5 w-2.5" /> {mm}:{ss} left
            </div>
          )}

          <h3 className="mt-1.5 pr-6 text-[15px] font-extrabold leading-tight text-foreground">
            {offerLabel ? `Wait — ${offerLabel} if you pay now` : "Your order isn't placed yet"}
          </h3>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            {offerLabel
              ? `Valid on this order only${offerCode ? ` · code ${offerCode}` : ""}`
              : "We're holding your items for a few minutes."}
          </p>

          {showProof && (
            <div className="mt-2 flex items-baseline gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5">
              {currentTotalLabel && (
                <span className="text-[11.5px] text-muted-foreground line-through">{currentTotalLabel}</span>
              )}
              <span className="text-[17px] font-extrabold text-emerald-700">{newTotalLabel}</span>
              <span className="ml-auto text-[10px] font-semibold text-emerald-700">You pay</span>
            </div>
          )}

          <button
            type="button"
            onClick={onClaim}
            className="mt-2.5 w-full h-10 rounded-xl bg-emerald-600 text-white text-[13.5px] font-extrabold active:scale-[0.99] transition-transform"
          >
            {alreadyClaimed || !offerLabel ? "Continue & pay now" : `Claim ${offerLabel} & pay`}
          </button>


          <div className="mt-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-emerald-600" /> 100% secure payment
            </span>
            <button
              type="button"
              onClick={onLeave}
              className="text-[11.5px] font-semibold text-muted-foreground underline underline-offset-2"
            >
              No thanks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
