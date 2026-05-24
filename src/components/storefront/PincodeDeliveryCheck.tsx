/**
 * PincodeDeliveryCheck — Amazon/Flipkart-style serviceability widget for PDP.
 *
 * - Uses local `estimateDelivery()` heuristic (no extra network)
 * - Persists pincode + city to the SAME localStorage keys used by
 *   DeliveryLocationDialog / CheckoutPage so checkout auto-fills
 * - Animated: expand, shake on error, scale-in success check
 * - Theme-aware via `var(--storefront-primary)`
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Truck, BadgeIndianRupee, CheckCircle2, X, Loader2, LocateFixed } from "lucide-react";
import { estimateDelivery } from "@/lib/deliveryEstimate";
import { navTap } from "@/lib/navHaptic";

interface Props {
  storeId: string;
  /** Effective product price (after sale). Used for free-shipping threshold. */
  price?: number;
  /** Optional free-shipping threshold from store shipping config */
  freeShippingAbove?: number | null;
  /** Whether COD is enabled at store level */
  codEnabled?: boolean;
}

const PIN_KEY = "storefront-delivery-pincode";
const CITY_KEY = "storefront-delivery-city";

function readSaved(storeId: string) {
  try {
    const pin =
      localStorage.getItem(PIN_KEY) ||
      localStorage.getItem("checkout-pincode") ||
      "";
    const city = localStorage.getItem(CITY_KEY) || "";
    const label = localStorage.getItem(`delivery_location_${storeId}`) || "";
    return { pin: pin.replace(/\D/g, "").slice(0, 6), city, label };
  } catch {
    return { pin: "", city: "", label: "" };
  }
}

function persist(storeId: string, pin: string, city: string) {
  try {
    localStorage.setItem(PIN_KEY, pin);
    localStorage.setItem("checkout-pincode", pin);
    if (city) localStorage.setItem(CITY_KEY, city);
    const label = `${city ? city + " · " : ""}${pin}`;
    localStorage.setItem(`delivery_location_${storeId}`, label);
    // Merge into express_checkout_${storeId} so checkout autofills
    const raw = localStorage.getItem(`express_checkout_${storeId}`);
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem(
      `express_checkout_${storeId}`,
      JSON.stringify({ ...prev, pincode: pin, ...(city ? { city } : {}) })
    );
    const addrRaw = localStorage.getItem("checkout_address");
    const prevAddr = addrRaw ? JSON.parse(addrRaw) : {};
    localStorage.setItem(
      "checkout_address",
      JSON.stringify({ ...prevAddr, pincode: pin, ...(city ? { city } : {}) })
    );
  } catch {}
}

/** Reverse-geocode pincode → city via free public Postal API (no key). */
async function lookupCity(pin: string): Promise<string | null> {
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    if (!r.ok) return null;
    const data = await r.json();
    const po = data?.[0]?.PostOffice?.[0];
    return po?.District || po?.Region || null;
  } catch {
    return null;
  }
}

export default function PincodeDeliveryCheck({
  storeId,
  price = 0,
  freeShippingAbove = null,
  codEnabled = true,
}: Props) {
  const initial = useMemo(() => readSaved(storeId), [storeId]);
  const [expanded, setExpanded] = useState(!initial.pin);
  const [pin, setPin] = useState(initial.pin);
  const [city, setCity] = useState(initial.city);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof estimateDelivery>>(
    initial.pin ? estimateDelivery(initial.pin) : null
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded) setTimeout(() => inputRef.current?.focus(), 80);
  }, [expanded]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 360);
  };

  const runCheck = async (candidate: string) => {
    const clean = candidate.replace(/\D/g, "").slice(0, 6);
    if (clean.length !== 6) {
      setError("Enter a valid 6-digit pincode");
      triggerShake();
      return;
    }
    setError(null);
    setChecking(true);
    const est = estimateDelivery(clean);
    // small artificial delay for perceived "checking" feel
    await new Promise((r) => setTimeout(r, 450));
    if (!est) {
      setChecking(false);
      setError("We can't estimate delivery for this pincode");
      triggerShake();
      return;
    }
    // Fetch city in background (don't block UI)
    let resolvedCity = city;
    lookupCity(clean).then((c) => {
      if (c) {
        setCity(c);
        persist(storeId, clean, c);
      }
    });
    setResult(est);
    persist(storeId, clean, resolvedCity);
    setChecking(false);
    setExpanded(false);
    navTap();
  };

  const onChangePin = (v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 6);
    setPin(clean);
    if (error) setError(null);
    if (clean.length === 6) runCheck(clean);
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("Location not available — enter pincode manually");
      triggerShake();
      return;
    }
    setChecking(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&zoom=16&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          );
          const data = await r.json();
          const pinFound = (data?.address?.postcode || "").replace(/\D/g, "").slice(0, 6);
          if (pinFound.length === 6) {
            setPin(pinFound);
            await runCheck(pinFound);
          } else {
            setChecking(false);
            setError("Couldn't detect pincode — enter manually");
            triggerShake();
          }
        } catch {
          setChecking(false);
          setError("Couldn't detect location");
          triggerShake();
        }
      },
      () => {
        setChecking(false);
        setError("Location access denied");
        triggerShake();
      },
      { timeout: 8000, maximumAge: 60_000 }
    );
  };

  const freeShipQualifies =
    freeShippingAbove != null && price >= Number(freeShippingAbove);
  const codAvailable =
    codEnabled && result && (result.tier === "metro" || result.tier === "tier1");

  // Compact saved-pincode strip with edit
  if (result && !expanded) {
    return (
      <div className="mx-4 mb-3 animate-in fade-in slide-in-from-top-1 duration-300">
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-3 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="relative h-9 w-9 shrink-0 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" strokeWidth={2.4} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Deliverable to {city || `pincode ${pin}`}
              </div>
              <div className="text-[13.5px] font-extrabold text-gray-900 leading-tight mt-0.5 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-emerald-700 truck-glide" strokeWidth={2.4} />
                By {result.rangeLabel}
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {codAvailable ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <BadgeIndianRupee className="h-3 w-3" /> COD Available
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                    Prepaid only in this area
                  </span>
                )}
                {freeShipQualifies && (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    <Truck className="h-3 w-3" /> Free Shipping
                  </span>
                )}
                {!freeShipQualifies && freeShippingAbove ? (
                  <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                    Add ₹{Math.max(0, Number(freeShippingAbove) - price).toFixed(0)} for free shipping
                  </span>
                ) : null}
              </div>
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="shrink-0 text-[11.5px] font-bold text-emerald-700 hover:text-emerald-800 active:scale-95 transition px-2 py-1 rounded"
            >
              Change
            </button>
          </div>
        </div>
        <Keyframes />
      </div>
    );
  }

  // CTA pill (collapsed default)
  if (!expanded) {
    return (
      <div className="mx-4 mb-3">
        <button
          onClick={() => setExpanded(true)}
          className="w-full group flex items-center gap-3 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2.5 hover:border-gray-400 active:scale-[0.99] transition"
        >
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center">
              <MapPin className="h-4.5 w-4.5 text-gray-700" strokeWidth={2.4} />
            </div>
            <span className="absolute top-0 right-0 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[13px] font-extrabold text-gray-900 leading-tight">
              Check delivery & COD availability
            </div>
            <div className="text-[11px] text-gray-500 leading-tight mt-0.5">
              Enter your pincode to see exact delivery date
            </div>
          </div>
          <span className="shrink-0 text-[11px] font-bold text-gray-500 group-hover:text-gray-800">→</span>
        </button>
      </div>
    );
  }

  // Expanded — input + actions
  return (
    <div className="mx-4 mb-3 animate-in fade-in slide-in-from-top-2 duration-300">
      <div
        className={`rounded-xl border border-gray-200 bg-white p-3 shadow-sm ${
          shake ? "shake-x" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-gray-700" strokeWidth={2.4} />
            <span className="text-[12.5px] font-extrabold text-gray-900">
              Enter delivery pincode
            </span>
          </div>
          <button
            onClick={() => setExpanded(false)}
            aria-label="Close"
            className="h-7 w-7 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-gray-100 active:scale-95 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => onChangePin(e.target.value)}
            placeholder="e.g. 400001"
            className={`flex-1 h-11 px-3 rounded-lg border bg-gray-50 text-[15px] font-bold tracking-[0.18em] text-gray-900 placeholder:font-medium placeholder:tracking-normal placeholder:text-gray-400 outline-none transition-colors ${
              error ? "border-red-300 bg-red-50" : "border-gray-200 focus:border-gray-900 focus:bg-white"
            }`}
          />
          <button
            onClick={() => runCheck(pin)}
            disabled={checking || pin.length !== 6}
            className="h-11 px-4 rounded-lg text-white text-[12px] font-extrabold uppercase tracking-wider disabled:opacity-50 active:scale-95 transition flex items-center gap-1.5"
            style={{ background: "var(--storefront-primary, #036B52)" }}
          >
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Check"}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button
            onClick={useMyLocation}
            disabled={checking}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-bold text-gray-700 hover:text-gray-900 disabled:opacity-50 transition"
          >
            <LocateFixed className="h-3.5 w-3.5" strokeWidth={2.4} />
            Use my location
          </button>
          {error ? (
            <span className="text-[11px] font-bold text-red-600 animate-in fade-in">{error}</span>
          ) : (
            <span className="text-[11px] text-gray-400">Auto-fills at checkout</span>
          )}
        </div>
      </div>
      <Keyframes />
    </div>
  );
}

function Keyframes() {
  return (
    <style>{`
      @keyframes shakeX { 0%{transform:translateX(0)} 20%{transform:translateX(-5px)} 40%{transform:translateX(5px)} 60%{transform:translateX(-3px)} 80%{transform:translateX(3px)} 100%{transform:translateX(0)} }
      .shake-x { animation: shakeX 360ms ease-in-out; }
      @keyframes truckGlide { 0%,100%{transform:translateX(0)} 50%{transform:translateX(2px)} }
      .truck-glide { animation: truckGlide 1.6s ease-in-out infinite; }
    `}</style>
  );
}
