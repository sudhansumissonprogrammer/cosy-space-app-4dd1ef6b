/**
 * PincodeSheet — Step 1.5 bottom-sheet after phone capture.
 * Collects only the 6-digit delivery pincode. On submit, parent hydrates
 * city/state via the pincode autofill effect and advances to the address form.
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  initial?: string;
  onSubmit: (pincode: string) => void;
  onClose: () => void;
}

export default function PincodeSheet({ initial = "", onSubmit, onClose }: Props) {
  const [pc, setPc] = useState(initial.replace(/\D/g, "").slice(0, 6));
  const inputRef = useRef<HTMLInputElement>(null);
  const valid = /^\d{6}$/.test(pc);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
        onClick={onClose}
        aria-hidden
      />
      {/* Close chip above sheet */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="sfg sfg-pill sfg-dark sfg-tap relative mx-auto mb-4 h-10 w-10 flex items-center justify-center"
      >
        <X className="h-5 w-5" />
      </button>
      {/* Sheet */}
      <div className="sfg sfg-sheet sfg-strong relative mx-auto w-full max-w-md px-5 pt-3 pb-6" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-bg, #fff) 78%, transparent)" }}>
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, #111) 18%, transparent)" }} />
        <div className="text-[16px] font-semibold">Add Delivery Address</div>

        <div className="relative mt-6">
          <label className="absolute -top-2 left-3 rounded px-1 text-[11px] text-muted-foreground" style={{ backgroundColor: "var(--storefront-bg, #fff)" }}>
            Pincode <span className="text-destructive">*</span>
          </label>
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            maxLength={6}
            value={pc}
            onChange={(e) => setPc(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && valid) onSubmit(pc);
            }}
            className="w-full h-14 rounded-xl border border-black/70 bg-transparent px-4 text-[16px] outline-none focus:border-black"
          />
        </div>

        <Button
          onClick={() => valid && onSubmit(pc)}
          disabled={!valid}
          className="mt-5 w-full h-12 rounded-lg text-[15px] font-bold bg-black hover:bg-black/90 disabled:bg-gray-300 disabled:text-white disabled:opacity-100"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
