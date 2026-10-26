/**
 * Shared store-location / city-page content contract.
 *
 * Used by the React storefront (via src/lib/storeLocations.ts re-export) and
 * the bot-render edge function so human and crawler output never diverge.
 *
 * Rules:
 * - Only verified facts may appear: records come from public.store_locations,
 *   which is seeded/owned by merchant-provided data. Never invent addresses,
 *   hours, photos, stock or services here.
 * - Replica disclosure for Utkal reuses the shared UTKAL_STATUS wording.
 * - Delivery-only cities must never be presented as physical branches.
 */
import { isUtkalContentStore } from "./utkalContent.ts";

export interface StoreLocationRecord {
  id: string;
  store_id: string;
  city: string;
  slug: string;
  location_type: string; // main_store | branch | partner_stockist | fulfilment | delivery_only
  store_name: string | null;
  address_line: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  map_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  opening_hours: Record<string, string> | null;
  photos: string[] | null;
  walk_in: boolean | null;
  pickup_available: boolean | null;
  pickup_notes: string | null;
  delivery_notes: string | null;
  returns_notes: string | null;
  local_inventory_source: string | null;
  central_dispatch: boolean;
  intro: string | null;
  content_verified_at: string | null;
  is_published: boolean;
}

type StoreLike = { id?: string | null; slug?: string | null; name?: string | null; state?: string | null };

export const LOCATION_TYPE_LABELS: Record<string, string> = {
  main_store: "Main store",
  branch: "Branch",
  partner_stockist: "Partner stockist",
  fulfilment: "Fulfilment location",
  delivery_only: "Delivery coverage",
};

export function locationTypeLabel(type: string): string {
  return LOCATION_TYPE_LABELS[type] || "Delivery coverage";
}

/** Bengaluru is also searched as Bangalore — one page, both names mentioned. */
export function cityAlias(city: string): string {
  return city.toLowerCase() === "bengaluru" ? "Bangalore" : "";
}

export function cityPageH1(store: StoreLike, city: string): string {
  return isUtkalContentStore(store)
    ? `First Copy & Replica Watches in ${city}`
    : `${store.name} in ${city}`;
}

export function cityPageTitle(store: StoreLike, city: string): string {
  return isUtkalContentStore(store)
    ? `First Copy & Replica Watches in ${city} | ${store.name}`
    : `${store.name} in ${city} — Shop Online`;
}

export function cityPageDescription(store: StoreLike, loc: StoreLocationRecord): string {
  const city = loc.city;
  if (isUtkalContentStore(store)) {
    const where = loc.location_type === "main_store" && loc.address_line
      ? `Visit the main store at ${loc.address_line} or order online.`
      : `Utkal Watches delivers to ${city} from its Rajkot store with cash on delivery.`;
    return `Shop first copy & replica watches in ${city}. ${where} Replica watches, not genuine brand products.`;
  }
  return loc.location_type === "main_store" && loc.address_line
    ? `Shop ${store.name} in ${city}. Visit us at ${loc.address_line} or order online.`
    : `Shop ${store.name} online in ${city}. Browse the catalogue and get delivery to ${city}.`;
}

/** Format {"mon":"10:00 AM - 7:00 PM",...} — collapses to "Open daily, …" when all days match. */
export function formatOpeningHours(hours: Record<string, string> | null): string | null {
  if (!hours) return null;
  const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const values = days.map((d) => (hours[d] || "").trim()).filter(Boolean);
  if (!values.length) return null;
  if (values.length === 7 && new Set(values).size === 1) return `Open daily, ${values[0]}`;
  return days
    .filter((d) => (hours[d] || "").trim())
    .map((d) => `${d[0].toUpperCase()}${d.slice(1)}: ${hours[d]}`)
    .join("; ");
}

/** Google Maps search URL for a verified address string (no invented coordinates). */
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function cityIntroParagraph(store: StoreLike, loc: StoreLocationRecord): string {
  if (loc.intro?.trim()) return loc.intro.trim();
  const city = loc.city;
  const alias = cityAlias(city);
  const cityText = alias ? `${city} (${alias})` : city;
  const hours = formatOpeningHours(loc.opening_hours);

  if (isUtkalContentStore(store)) {
    if (loc.location_type === "main_store" && loc.address_line) {
      return `Utkal Watches' main store is at ${loc.address_line}${hours ? ` — ${hours.replace(/^Open/, "open")}` : ""}. ` +
        `Browse the full catalogue online, compare listed prices and photos, and order with cash on delivery. ` +
        `Walk-in customers can check the available watches at the store before buying. ` +
        `These are first copy / replica watches, not genuine products of the brands they resemble.`;
    }
    return `Utkal Watches is an online first-copy watch store delivering to ${cityText}. ` +
      `Browse the full catalogue, compare listed prices and product photos, and order online with cash on delivery. ` +
      `Every order is packed and dispatched from the Utkal Watches main store in Rajkot, Gujarat. ` +
      `These are first copy / replica watches, not genuine products of the brands they resemble.`;
  }

  if (loc.location_type === "main_store" && loc.address_line) {
    return `${store.name} is located at ${loc.address_line}${hours ? ` — ${hours.replace(/^Open/, "open")}` : ""}. ` +
      `Browse the catalogue online or visit the store.`;
  }
  return `${store.name} delivers to ${cityText}. Browse the catalogue online and place your order for delivery to ${city}.`;
}

export interface CityFaq { q: string; a: string }

/**
 * FAQ answers built only from verified facts. `mainStore` is the store's
 * main_store location record (if any) so delivery cities can state where
 * orders are dispatched from.
 */
export function cityFaqItems(
  store: StoreLike & { whatsapp_number?: string | null },
  loc: StoreLocationRecord,
  mainStore: StoreLocationRecord | null,
): CityFaq[] {
  const city = loc.city;
  const utkal = isUtkalContentStore(store);
  const items: CityFaq[] = [];
  const isPhysical = loc.location_type !== "delivery_only" && !!loc.address_line;
  const hours = formatOpeningHours(loc.opening_hours);

  if (isPhysical) {
    items.push({
      q: `Can I visit the ${store.name} store in ${city}?`,
      a: `Yes. The store is at ${loc.address_line}${hours ? ` and is ${hours.replace(/^Open/, "open")}` : ""}.` +
        (loc.whatsapp ? ` You can also message ${loc.whatsapp} on WhatsApp before visiting.` : ""),
    });
  } else {
    items.push({
      q: `Does ${store.name} have a physical store in ${city}?`,
      a: `No. ${store.name} serves ${city} online` +
        (mainStore?.city ? ` — orders are dispatched from the main store in ${mainStore.city}.` : ".") +
        ` You can browse the full catalogue and order for delivery to ${city}.`,
    });
  }

  if (utkal) {
    items.push({
      q: `Is cash on delivery available in ${city}?`,
      a: `Yes, cash on delivery is available for orders delivered to ${city}.`,
    });
  }

  if (mainStore && loc.slug !== mainStore.slug) {
    items.push({
      q: "Where will my order be dispatched from?",
      a: `All orders are packed and dispatched from the ${store.name} main store in ${mainStore.city}${store.state ? `, ${store.state}` : ""}.`,
    });
  }

  if (utkal) {
    items.push({
      q: "Are these genuine brand watches?",
      a: "No. Utkal Watches sells first copy / replica watches. They are not genuine products of, and are not affiliated with or authorized by, the brands they resemble.",
    });
  }

  return items;
}

export function directoryTitle(store: StoreLike): string {
  return `Stores & Delivery Cities | ${store.name}`;
}

export function directoryH1(store: StoreLike): string {
  return isUtkalContentStore(store)
    ? `${store.name} — Stores & Delivery Cities`
    : `${store.name} Stores & Delivery Cities`;
}

export function directoryDescription(store: StoreLike, locations: StoreLocationRecord[]): string {
  const main = locations.find((l) => l.location_type === "main_store");
  const cityCount = locations.length;
  if (isUtkalContentStore(store)) {
    return `Utkal Watches delivers first copy & replica watches across ${cityCount} cities in India` +
      (main ? `, with its main store in ${main.city}` : "") +
      `. Find your city for delivery details.`;
  }
  return `${store.name} serves ${cityCount} cities` +
    (main ? ` with its main store in ${main.city}` : "") +
    `. Find your city for store and delivery details.`;
}
