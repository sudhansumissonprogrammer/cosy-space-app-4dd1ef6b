import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Gift, X } from "lucide-react";
import { toast } from "sonner";
import { fireMetaCAPI } from "@/lib/metaCapi";

interface ExitIntentPopupProps {
  storeId: string;
  storeName: string;
}

export default function ExitIntentPopup({ storeId, storeName }: ExitIntentPopupProps) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activated, setActivated] = useState(false);

  // Only fetch coupon after exit intent is first detected (5s delay + mouseleave)
  // This prevents an unnecessary API call on every page load
  const { data: coupon } = useQuery({
    queryKey: ["exit-intent-coupon", storeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .order("discount_value", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000,
    enabled: activated, // Only fetch when exit intent system activates
  });

  // Activate coupon fetch after 5s delay (don't block initial load)
  useEffect(() => {
    const alreadyShown = sessionStorage.getItem(`exit_popup_${storeId}`);
    if (alreadyShown) return;

    const timer = setTimeout(() => {
      setActivated(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, [storeId]);

  // Set up exit intent listeners once coupon is available
  useEffect(() => {
    if (!coupon) return;

    const alreadyShown = sessionStorage.getItem(`exit_popup_${storeId}`);
    if (alreadyShown) return;

    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        sessionStorage.setItem(`exit_popup_${storeId}`, "1");
        setShow(true);
      }
    };

    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [coupon, storeId]);

  const handleCopy = async () => {
    if (!coupon) return;
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      toast.success("Coupon code copied!");
      
      // Fire CAPI Lead event
      fireMetaCAPI({
        storeId,
        eventName: "Lead",
        customData: {
          content_type: "coupon",
          content_ids: [coupon.id],
        },
      });

      setTimeout(() => setShow(false), 1500);
    } catch {
      toast.error("Failed to copy");
    }
  };

  if (!coupon) return null;

  const discountText = coupon.discount_type === "percentage"
    ? `${coupon.discount_value}% OFF`
    : `${coupon.discount_value} OFF`;

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className="max-w-[340px] rounded-2xl p-0 overflow-hidden border-0 shadow-2xl">
        <button
          onClick={() => setShow(false)}
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full transition-all" style={{ backgroundColor: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 8%, transparent)", color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 pt-8 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
            <Gift className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-bold" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>Wait! Don't leave yet 🎉</h3>
          <p className="mt-1 text-sm" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 60%, transparent)" }}>
            Here's a special discount from {storeName}
          </p>
        </div>

        <div className="px-6 pb-6 text-center">
          <div className="my-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-4">
            <Badge className="mb-2 text-lg font-extrabold px-3 py-1">
              {discountText}
            </Badge>
            <div className="flex items-center justify-center gap-2 mt-3">
              <code className="text-lg font-mono font-bold tracking-wider" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
                {coupon.code}
              </code>
              <Button
                size="sm"
                variant={copied ? "secondary" : "default"}
                onClick={handleCopy}
                className="text-xs font-bold"
              >
                {copied ? "Copied! ✓" : <><Copy className="h-3 w-3 mr-1" /> Copy</>}
              </Button>
            </div>
            {coupon.min_order_amount > 0 && (
              <p className="mt-2 text-[10px]" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
                Min. order: {coupon.min_order_amount}
              </p>
            )}
          </div>

          <Button className="w-full font-semibold" onClick={() => setShow(false)}>
            Continue Shopping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
