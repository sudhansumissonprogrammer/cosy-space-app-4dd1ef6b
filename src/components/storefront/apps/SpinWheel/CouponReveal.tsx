import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface CouponRevealProps {
  code: string;
  label: string;
  discountText: string;
  minOrder?: number;
  onClose: () => void;
}

export default function CouponReveal({ code, discountText, minOrder, onClose }: CouponRevealProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      try {
        sessionStorage.setItem("pending_coupon", code);
        localStorage.setItem("pending_coupon", code);
      } catch {}
      setCopied(true);
      toast.success("Coupon copied — it'll auto-apply at checkout");
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="text-center">
      <div
        className="relative mx-auto mb-4 max-w-[320px] bg-[#faf5d7] px-6 py-8 text-slate-900"
        style={{
          maskImage:
            "radial-gradient(circle at 0 50%, transparent 12px, black 13px), radial-gradient(circle at 100% 50%, transparent 12px, black 13px)",
          WebkitMaskImage:
            "radial-gradient(circle at 0 50%, transparent 12px, black 13px), radial-gradient(circle at 100% 50%, transparent 12px, black 13px)",
          WebkitMaskComposite: "source-in",
          maskComposite: "intersect",
          borderRadius: 16,
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">You Won</p>
        <p className="mt-2 text-2xl font-extrabold text-slate-900">{discountText}</p>
        <div className="mt-4 border-y-2 border-dashed border-slate-400/50 py-3">
          <p className="text-[11px] font-medium text-slate-500">Use code</p>
          <p className="mt-1 font-mono text-2xl font-black tracking-widest text-slate-900">{code}</p>
        </div>
        {minOrder && minOrder > 0 ? (
          <p className="mt-3 text-[11px] text-slate-500">Min. order ₹{minOrder}</p>
        ) : null}
      </div>

      <Button
        onClick={copy}
        className="w-full h-12 rounded-xl font-bold gap-2"
        variant={copied ? "secondary" : "default"}
      >
        {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy Code</>}
      </Button>
      <button
        onClick={onClose}
        className="mt-3 text-xs font-medium text-white/70 hover:text-white"
      >
        Continue Shopping
      </button>
    </div>
  );
}
