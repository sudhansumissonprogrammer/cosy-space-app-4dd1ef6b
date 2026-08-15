/**
 * Shared 6-digit Indian pincode → { city, state } resolver.
 * Order: our own edge function (no CORS / rate-limit issues) → postalpincode.in → zippopotam.us.
 * Results are memoised in-memory + localStorage so the PDP checker and checkout
 * never re-fetch the same pincode.
 */
const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export interface PincodeInfo { city: string; state: string }

const mem = new Map<string, PincodeInfo>();
const LS_KEY = "pincode_cache_v1";

function readCache(pin: string): PincodeInfo | null {
  if (mem.has(pin)) return mem.get(pin)!;
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    const hit = all?.[pin];
    if (hit?.city || hit?.state) { mem.set(pin, hit); return hit; }
  } catch { /* ignore */ }
  return null;
}

function writeCache(pin: string, info: PincodeInfo) {
  mem.set(pin, info);
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
    all[pin] = info;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export async function lookupPincode(pincode: string): Promise<PincodeInfo | null> {
  const pin = (pincode || "").replace(/\D/g, "");
  if (!/^\d{6}$/.test(pin)) return null;
  const cached = readCache(pin);
  if (cached) return cached;

  const attempts: Array<() => Promise<PincodeInfo>> = [
    async () => {
      const r = await fetch(`${SUPABASE_FUNCTIONS_URL}/pincode-lookup?pincode=${pin}`);
      const j = await r.json();
      if (!j?.ok) throw new Error("proxy no result");
      return { city: String(j.city || ""), state: String(j.state || "") };
    },
    async () => {
      const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
      const j = await r.json();
      const po = j?.[0]?.PostOffice?.[0];
      if (!po) throw new Error("no post office");
      return { city: String(po.District || ""), state: String(po.State || "") };
    },
    async () => {
      const r = await fetch(`https://api.zippopotam.us/in/${pin}`);
      const j = await r.json();
      const p = j?.places?.[0];
      if (!p) throw new Error("no place");
      return { city: String(p["place name"] || ""), state: String(p["state"] || "") };
    },
  ];

  for (const run of attempts) {
    try {
      const res = await run();
      if (res.city || res.state) { writeCache(pin, res); return res; }
    } catch { /* next source */ }
  }
  return null;
}

/**
 * Persist a confirmed delivery pincode so checkout auto-fills it.
 * Mirrors the keys DeliveryLocationDialog / CheckoutV2Page already read.
 */
export function saveDeliveryPincode(storeId: string | undefined, pin: string, info: PincodeInfo) {
  try {
    if (storeId) {
      const key = `express_checkout_${storeId}`;
      const prev = JSON.parse(localStorage.getItem(key) || "{}");
      localStorage.setItem(key, JSON.stringify({
        ...prev,
        pincode: pin,
        city: info.city || prev.city || "",
        state: info.state || prev.state || "",
      }));
      const label = `${info.city || ""}${info.city ? " · " : ""}${pin}`;
      localStorage.setItem(`delivery_location_${storeId}`, label);
    }
    const prevAddr = (() => {
      try { return JSON.parse(localStorage.getItem("checkout_address") || "{}"); } catch { return {}; }
    })();
    localStorage.setItem("checkout_address", JSON.stringify({
      ...prevAddr,
      city: info.city || prevAddr.city || "",
      state: info.state || prevAddr.state || "",
      pincode: pin,
    }));
    window.dispatchEvent(new Event("checkout_address_ready"));
  } catch { /* ignore */ }
}

export function getSavedPincode(storeId?: string): string {
  try {
    if (storeId) {
      const saved = JSON.parse(localStorage.getItem(`express_checkout_${storeId}`) || "{}");
      if (/^\d{6}$/.test(String(saved.pincode || ""))) return String(saved.pincode);
    }
    const addr = JSON.parse(localStorage.getItem("checkout_address") || "{}");
    if (/^\d{6}$/.test(String(addr.pincode || ""))) return String(addr.pincode);
  } catch { /* ignore */ }
  return "";
}
