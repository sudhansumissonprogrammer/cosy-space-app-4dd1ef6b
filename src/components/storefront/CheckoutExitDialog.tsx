import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmExit: () => void;
}

export default function CheckoutExitDialog({ open, onOpenChange, onConfirmExit }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[320px] rounded-2xl p-0 overflow-hidden">
        <button onClick={() => onOpenChange(false)} className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full hover:scale-110 active:scale-95 transition-all" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)", color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }} aria-label="Close dialog"><X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" /></button>
        <div className="p-6 pt-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warning/10"><ArrowLeft className="h-5 w-5 text-warning" /></div>
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>Exit checkout?</DialogTitle>
            <DialogDescription className="text-xs" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>Are you sure you want to leave? Your order details won't be saved.</DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex flex-col gap-2">
            <Button variant="outline" className="w-full border-destructive/30 text-destructive hover:bg-destructive/5 font-semibold text-xs" onClick={onConfirmExit}>Yes, exit checkout</Button>
            <Button className="w-full font-semibold text-xs" onClick={() => onOpenChange(false)}>No, continue checkout</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
