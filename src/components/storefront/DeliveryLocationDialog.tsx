/**
 * DeliveryLocationDialog — popup to set delivery address.
 * Saves to localStorage so checkout auto-fills (no double entry).
 *
 * Storage keys (read by CheckoutPage):
 *  - `express_checkout_${storeId}` → { fullName, phone, streetAddress, city, state, pincode }
 *  - `checkout_address`            → { street_address, city, state, pincode }
 *  - `delivery_location_${storeId}` → display label for header
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  storeId: string;
  onSaved?: (label: string) => void;
}

export function getSavedDeliveryLabel(storeId: string): string | null {
  try { return localStorage.getItem(`delivery_location_${storeId}`); } catch { return null; }
}

export default function DeliveryLocationDialog({ open, onClose, storeId, onSaved }: Props) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [pincode, setPincode] = useState("");
  const [saving, setSaving] = useState(false);

  // Hydrate from any existing express_checkout data
  useEffect(() => {
    if (!open) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`express_checkout_${storeId}`) || "{}");
      setFullName(saved.fullName || "");
      setPhone(saved.phone || "");
      setStreetAddress(saved.streetAddress || "");
      setCity(saved.city || "");
      setStateVal(saved.state || "");
      setPincode(saved.pincode || "");
    } catch {}
  }, [open, storeId]);

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!streetAddress.trim() || !city.trim() || !pincode.trim()) {
      toast.error("Please fill address, city and pincode");
      return;
    }
    if (pincode.trim().length !== 6 || !/^\d{6}$/.test(pincode.trim())) {
      toast.error("Pincode must be 6 digits");
      return;
    }
    setSaving(true);
    const payload = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      streetAddress: streetAddress.trim(),
      city: city.trim(),
      state: stateVal.trim(),
      pincode: pincode.trim(),
    };
    try {
      localStorage.setItem(`express_checkout_${storeId}`, JSON.stringify(payload));
      localStorage.setItem("checkout_address", JSON.stringify({
        street_address: payload.streetAddress,
        city: payload.city,
        state: payload.state,
        pincode: payload.pincode,
      }));
      if (payload.phone) localStorage.setItem("checkout_phone", payload.phone);
      const label = `${payload.city}${payload.pincode ? " · " + payload.pincode : ""}`;
      localStorage.setItem(`delivery_location_${storeId}`, label);
      toast.success("Delivery location saved");
      onSaved?.(label);
      onClose();
    } catch {
      toast.error("Couldn't save location");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" /> Set delivery location
          </DialogTitle>
          <DialogDescription className="text-xs">
            Saved on this device — we'll auto-fill it at checkout.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="dl-name" className="text-xs">Full name</Label>
              <Input id="dl-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="h-9" />
            </div>
            <div>
              <Label htmlFor="dl-phone" className="text-xs">Phone</Label>
              <Input id="dl-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" className="h-9" />
            </div>
          </div>
          <div>
            <Label htmlFor="dl-street" className="text-xs">Street address *</Label>
            <Input id="dl-street" value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} placeholder="House no, area, landmark" className="h-9" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="dl-city" className="text-xs">City *</Label>
              <Input id="dl-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" className="h-9" required />
            </div>
            <div>
              <Label htmlFor="dl-state" className="text-xs">State</Label>
              <Input id="dl-state" value={stateVal} onChange={(e) => setStateVal(e.target.value)} placeholder="Maharashtra" className="h-9" />
            </div>
          </div>
          <div>
            <Label htmlFor="dl-pin" className="text-xs">Pincode *</Label>
            <Input id="dl-pin" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="400001" className="h-9" inputMode="numeric" required />
          </div>
          <Button type="submit" disabled={saving} className="w-full h-10">
            {saving ? "Saving..." : "Save location"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
