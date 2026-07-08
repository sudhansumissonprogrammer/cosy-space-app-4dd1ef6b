/**
 * PincodeSheet — Step 1.5 bottom-sheet after phone capture.
 * Collects only the 6-digit delivery pincode. On submit, parent hydrates
 * city/state via the pincode autofill effect and advances to the address form.
 *
 * Keyboard-safe: uses window.visualViewport to keep the sheet + input above
 * the on-screen keyboard on Android/iOS. Without this the sheet stays glued
 * to the *layout* viewport bottom (which the keyboard covers) so the input
 * and Continue button disappear the moment the shopper starts typing.
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
  const [kbOffset, setKbOffset] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const valid = /^\d{6}$/.test(pc);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Track the visual viewport so the sheet lifts above the keyboard.
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const update = () => {
      const bottomInset = window.innerHeight - vv.height - vv.offsetTop;
      setKbOffset(Math.max(0, bottomInset));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // When the keyboard opens, scroll the input into view inside the sheet.
  useEffect(() => {
    if (kbOffset <= 0) return;
    const t = setTimeout(() => {
      inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 120);
    return () => clearTimeout(t);
  }, [kbOffset]);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto"
      style={{ paddingBottom: kbOffset }}
    >
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
        className="relative mx-auto mb-3 h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center flex-shrink-0"
      >
        <X className="h-5 w-5" />
      </button>
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative mx-auto w-full max-w-md bg-white rounded-t-2xl px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain"
        style={{ maxHeight: `calc(100dvh - ${kbOffset + 72}px)` }}
      >
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
