/**
 * High-intent exit-save sheet for checkout.
 *
 * Fires at most once per session when the shopper tries to leave checkout
 * (mobile back-press, desktop mouse-out, or long idle at the payment step).
 * Offers the store's WhatsApp-exclusive coupon (e.g. ₹100 off) which, on
 * claim, replaces any smaller auto-applied coupon.
 *
 * Presentation only — all coupon validation stays server-side.
 */
import { useEffect, useState } from "react";
import { X, ShieldCheck, Truck, BadgeCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    const id = window.setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  if (!open) return null;

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Special offer before you leave"
      onClick={onClose}
    >
      <div
        className="relative w-full sm:max-w-[400px] bg-white rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 h-8 w-8 rounded-full bg-black/5 text-black/50 flex items-center justify-center"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        {/* Offer header */}
        <div className="bg-gradient-to-b from-emerald-50 to-white px-5 pt-6 pb-4 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 text-white text-[11px] font-bold uppercase tracking-wide px-2.5 py-1">
            <Clock className="h-3 w-3" /> {offerLabel ? "Offer expires in" : "Order held for"} {mm}:{ss}
          </div>
          <h3 className="mt-3 text-[20px] font-extrabold leading-tight text-foreground">
            {offerLabel ? `Wait — get ${offerLabel} if you pay now` : "Wait — your order isn't placed yet"}
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {offerLabel
              ? "This discount is only valid on this order. Leaving will lose it."
              : "We're holding your items and this price for a few minutes. Finish now to confirm."}
          </p>
        </div>


        {/* Price proof */}
        {(currentTotalLabel || newTotalLabel) && (
          <div className="mx-5 rounded-xl border border-dashed border-emerald-400 bg-emerald-50/60 p-3 flex items-center justify-center gap-3">
            {currentTotalLabel && (
              <span className="text-[15px] text-muted-foreground line-through">{currentTotalLabel}</span>
            )}
            {newTotalLabel && (
              <span className="text-[22px] font-extrabold text-emerald-700">{newTotalLabel}</span>
            )}
          </div>
        )}
        {offerCode && (
          <div className="mt-2 text-center text-[11.5px] text-muted-foreground">
            Code <span className="font-mono font-bold text-foreground">{offerCode}</span> applies automatically
          </div>
        )}

        {/* Trust row */}
        <div className="mt-3 px-5 grid grid-cols-3 gap-2 text-center">
          {[
            { icon: ShieldCheck, label: "100% Secure\nPayment" },
            { icon: Truck, label: "Fast\nDelivery" },
            { icon: BadgeCheck, label: "Easy\nReturns" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <Icon className="h-4 w-4 text-emerald-600" />
              <span className="text-[10.5px] leading-tight text-muted-foreground whitespace-pre-line">{label}</span>
            </div>
          ))}
        </div>

        <div className="p-5 pt-4 space-y-2">
          <Button
            className="w-full h-12 text-[15px] font-extrabold bg-emerald-600 hover:bg-emerald-700"
            onClick={onClaim}
          >
            {alreadyClaimed || !offerLabel ? "Continue & pay now" : `Claim ${offerLabel} & pay now`}
          </Button>

          <button
            type="button"
            onClick={onLeave}
            className="w-full h-10 text-[13px] font-semibold text-muted-foreground underline underline-offset-2"
          >
            No thanks, go back
          </button>
        </div>
      </div>
    </div>
  );
}
