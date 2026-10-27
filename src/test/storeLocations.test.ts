import { describe, expect, it } from "vitest";
import {
  cityFaqItems,
  cityIntroParagraph,
  cityPageDescription,
  cityPageH1,
  cityPageTitle,
  directoryDescription,
  formatOpeningHours,
  locationTypeLabel,
  mapsSearchUrl,
  type StoreLocationRecord,
} from "@/lib/storeLocations";

const UTKAL = { id: "ab19143d-87a9-490e-90b7-837313522782", slug: "utkalwatches", name: "Utkal Watch" };
const GENERIC = { id: "00000000-0000-0000-0000-0000000000aa", slug: "acme", name: "Acme Store" };

const DAILY_HOURS = {
  mon: "10:00 AM - 7:00 PM", tue: "10:00 AM - 7:00 PM", wed: "10:00 AM - 7:00 PM",
  thu: "10:00 AM - 7:00 PM", fri: "10:00 AM - 7:00 PM", sat: "10:00 AM - 7:00 PM",
  sun: "10:00 AM - 7:00 PM",
};

function loc(overrides: Partial<StoreLocationRecord>): StoreLocationRecord {
  return {
    id: "x", store_id: UTKAL.id, city: "Mumbai", slug: "mumbai",
    location_type: "delivery_only", store_name: null, address_line: null,
    pincode: null, latitude: null, longitude: null, map_url: null,
    phone: null, whatsapp: null, opening_hours: null, photos: [],
    walk_in: null, pickup_available: null, pickup_notes: null,
    delivery_notes: null, returns_notes: null, local_inventory_source: null,
    central_dispatch: true, intro: null, content_verified_at: null,
    is_published: true, ...overrides,
  };
}

const RAJKOT = loc({
  city: "Rajkot", slug: "rajkot", location_type: "main_store",
  address_line: "Sant Kabir Main Rd, Rajkot, Gujarat",
  whatsapp: "7978394101", opening_hours: DAILY_HOURS,
});

describe("city page metadata", () => {
  it("uses plain watch wording for Utkal", () => {
    expect(cityPageH1(UTKAL, "Mumbai")).toBe("Watches in Mumbai — Utkal Watch");
    expect(cityPageTitle(UTKAL, "Mumbai")).toBe("Buy Watches Online in Mumbai | Utkal Watch");
  });

  it("uses neutral wording for generic stores (no replica terms)", () => {
    expect(cityPageH1(GENERIC, "Mumbai")).toBe("Acme Store in Mumbai");
    expect(cityPageTitle(GENERIC, "Mumbai")).toBe("Acme Store in Mumbai — Shop Online");
    expect(cityPageDescription(GENERIC, loc({}))).not.toMatch(/replica|first copy/i);
  });

  it("description for delivery cities states Rajkot dispatch and replica disclosure", () => {
    const desc = cityPageDescription(UTKAL, loc({}));
    expect(desc).toContain("Mumbai");
    expect(desc).toContain("Rajkot");
    expect(desc).toContain("Rajkot");
  });

  it("description for the main store cites the verified address", () => {
    expect(cityPageDescription(UTKAL, RAJKOT)).toContain("Sant Kabir Main Rd");
  });
});

describe("city intro paragraphs", () => {
  it("delivery-only cities never claim a physical branch", () => {
    const intro = cityIntroParagraph(UTKAL, loc({ city: "Pune", slug: "pune" }));
    expect(intro).toContain("online");
    expect(intro).toContain("Pune");
    expect(intro).not.toMatch(/visit (our|the) store/i);
  });

  it("Bengaluru intro mentions the Bangalore alias", () => {
    expect(cityIntroParagraph(UTKAL, loc({ city: "Bengaluru", slug: "bengaluru" }))).toContain("Bangalore");
  });

  it("main store intro includes verified address and hours", () => {
    const intro = cityIntroParagraph(UTKAL, RAJKOT);
    expect(intro).toContain("Sant Kabir Main Rd");
    expect(intro).toContain("10:00 AM - 7:00 PM");
  });

  it("a merchant-written intro override wins", () => {
    expect(cityIntroParagraph(UTKAL, loc({ intro: "Custom intro." }))).toBe("Custom intro.");
  });

  it("Utkal intros stay compact and drop the retired first-copy wording", () => {
    const delivery = cityIntroParagraph(UTKAL, loc({ city: "Pune", slug: "pune" }));
    expect(delivery).not.toMatch(/first[- ]copy/i);
    expect(delivery.length).toBeLessThanOrEqual(200);
    const main = cityIntroParagraph(UTKAL, RAJKOT);
    expect(main).not.toMatch(/first[- ]copy/i);
    expect(main.length).toBeLessThanOrEqual(220);
  });
});

describe("city FAQ — verified facts only", () => {
  it("delivery city says there is no physical store and names the dispatch city", () => {
    const faq = cityFaqItems(UTKAL, loc({}), RAJKOT);
    const visit = faq.find((f) => f.q.includes("physical store"));
    expect(visit?.a).toMatch(/^No\./);
    expect(visit?.a).toContain("Rajkot");
    const dispatch = faq.find((f) => f.q.includes("dispatched from"));
    expect(dispatch?.a).toContain("Rajkot");
  });

  it("main store answers the visit question with address and hours", () => {
    const faq = cityFaqItems(UTKAL, RAJKOT, RAJKOT);
    const visit = faq.find((f) => f.q.includes("Can I visit"));
    expect(visit?.a).toContain("Sant Kabir Main Rd");
    expect(visit?.a).toContain("10:00 AM - 7:00 PM");
    // No dispatch-from question on the main store's own page
    expect(faq.some((f) => f.q.includes("dispatched from"))).toBe(false);
  });

  it("Utkal FAQ discloses replica status; generic store FAQ does not", () => {
    const utkalFaq = cityFaqItems(UTKAL, loc({}), RAJKOT);
    expect(utkalFaq.some((f) => f.q.includes("genuine"))).toBe(true);
    const genericFaq = cityFaqItems(GENERIC, loc({}), null);
    expect(genericFaq.some((f) => /replica|first copy/i.test(f.a))).toBe(false);
  });

  it("omits the dispatch answer when no main store is known", () => {
    const faq = cityFaqItems(GENERIC, loc({}), null);
    expect(faq.some((f) => f.q.includes("dispatched from"))).toBe(false);
  });
});

describe("helpers", () => {
  it("collapses identical daily hours", () => {
    expect(formatOpeningHours(DAILY_HOURS)).toBe("Open daily, 10:00 AM - 7:00 PM");
  });

  it("returns null for empty hours", () => {
    expect(formatOpeningHours(null)).toBeNull();
    expect(formatOpeningHours({})).toBeNull();
  });

  it("labels unknown location types as delivery coverage", () => {
    expect(locationTypeLabel("main_store")).toBe("Main store");
    expect(locationTypeLabel("whatever")).toBe("Delivery coverage");
  });

  it("builds a maps search URL from the address", () => {
    expect(mapsSearchUrl("Sant Kabir Main Rd, Rajkot")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Sant%20Kabir%20Main%20Rd%2C%20Rajkot",
    );
  });

  it("directory description names the main store city", () => {
    expect(directoryDescription(UTKAL, [RAJKOT, loc({})])).toContain("Rajkot");
  });
});
