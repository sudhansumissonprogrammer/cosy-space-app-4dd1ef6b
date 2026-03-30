/**
 * BuyNowPhoneModal — Theme 16 exclusive.
 * Collects phone, triggers geolocation + reverse-geocode,
 * saves to localStorage, then redirects to checkout.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeSlug: string;
  /** Called before navigating — lets parent add item to cart etc. */
  onBeforeNavigate?: () => void;
}

export default function BuyNowPhoneModal({
  open,
  onOpenChange,
  storeSlug,
  onBeforeNavigate,
}: Props) {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem("checkout_phone") || "";
    } catch {
      return "";
    }
  });
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      toast.error("Please enter a valid 10-digit mobile number");
      return;
    }

    setLoading(true);

    // Save phone
    try {
      localStorage.setItem("checkout_phone", cleaned);
    } catch {}

    // Try geolocation + reverse geocode
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 300000,
        });
      });

      const { data } = await supabase.functions.invoke("reverse-geocode", {
        body: { lat: pos.coords.latitude, lng: pos.coords.longitude },
      });

      if (data?.success && data?.address) {
        try {
          localStorage.setItem(
            "checkout_address",
            JSON.stringify(data.address)
          );
        } catch {}
      }
    } catch {
      // Location denied or geocode failed — continue without address
    }

    setLoading(false);
    onBeforeNavigate?.();
    onOpenChange(false);
    navigate(storefrontPath(storeSlug, "checkout"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-lg font-bold">
            Enter your mobile number
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">
            We'll use this to confirm your order
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Phone input */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
              +91
            </span>
            <Input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              placeholder="Enter 10-digit number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="pl-12 h-12 text-base rounded-xl"
              autoFocus
            />
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5" />
              Secure checkout
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Privacy protected
            </span>
          </div>

          {/* Continue button */}
          <Button
            onClick={handleContinue}
            disabled={loading || phone.replace(/\D/g, "").length !== 10}
            className="w-full h-12 rounded-xl text-sm font-bold uppercase tracking-wider"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Getting your location...
              </>
            ) : (
              "Continue to Checkout"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
