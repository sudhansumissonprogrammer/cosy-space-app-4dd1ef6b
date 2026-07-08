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
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      {/* Close chip above sheet */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="relative mx-auto mb-4 h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center"
      >
        <X className="h-5 w-5" />
      </button>
      {/* Sheet */}
      <div className="relative mx-auto w-full max-w-md bg-white rounded-t-2xl px-5 pt-5 pb-6">
        <div className="text-[16px] font-semibold">Add Delivery Address</div>

        <div className="relative mt-6">
          <label className="absolute -top-2 left-3 bg-white px-1 text-[11px] text-muted-foreground">
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
