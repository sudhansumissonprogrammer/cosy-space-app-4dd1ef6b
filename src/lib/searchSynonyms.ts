/**
 * Indian-market spelling / synonym map for storefront search.
 *
 * Keys are what shoppers type (misspellings, Hindi/Hinglish words),
 * values are the canonical English word most likely used in product titles.
 * Applied client-side before hitting the `search_products` RPC so the
 * database only ever sees the canonical token — no migration needed to
 * add a new word here.
 */
const SYNONYMS: Record<string, string> = {
  // sarees
  sari: "saree",
  sadi: "saree",
  sadee: "saree",
  sarre: "saree",
  seree: "saree",
  sarees: "saree",
  // jewellery basics
  jwellery: "jewellery",
  jwelry: "jewellery",
  jewelry: "jewellery",
  jewellary: "jewellery",
  jhumki: "jhumka",
  jhumke: "jhumka",
  jumka: "jhumka",
  earing: "earring",
  earings: "earring",
  earrings: "earring",
  tops: "earring",
  chein: "chain",
  chan: "chain",
  chains: "chain",
  brasslet: "bracelet",
  braslet: "bracelet",
  bracelate: "bracelet",
  kada: "kada",
  kara: "kada",
  chudi: "bangle",
  chudiyan: "bangle",
  churi: "bangle",
  bangles: "bangle",
  payal: "anklet",
  panjeb: "anklet",
  anklets: "anklet",
  mangalsutra: "mangalsutra",
  mangalsutr: "mangalsutra",
  nose: "nosepin",
  nathni: "nosepin",
  mala: "necklace",
  haar: "necklace",
  neckles: "necklace",
  necklaces: "necklace",
  pendent: "pendant",
  locket: "pendant",
  ring: "ring",
  rings: "ring",
  anguthi: "ring",
  bichiya: "toe ring",
  // watches / accessories
  ghadi: "watch",
  ghari: "watch",
  wach: "watch",
  watches: "watch",
  belt: "belt",
  purse: "handbag",
  bag: "handbag",
  // apparel
  kurti: "kurti",
  kurta: "kurta",
  lehnga: "lehenga",
  lahenga: "lehenga",
  langa: "lehenga",
  suit: "suit",
  tshirt: "t-shirt",
  tshirts: "t-shirt",
  shrt: "shirt",
  jeens: "jeans",
  pent: "pant",
  chappal: "sandal",
  jutti: "footwear",
  shoos: "shoes",
  // generic
  gold: "gold",
  goldd: "gold",
  silwer: "silver",
  siver: "silver",
  dimond: "diamond",
  daimond: "diamond",
  artifical: "artificial",
};

/** Words that add no signal and only hurt AND-matching. */
const STOPWORDS = new Set([
  "for", "the", "and", "with", "of", "in", "a", "an", "under", "best", "new",
  "buy", "online", "price", "ka", "ke", "ki", "wala", "wali", "hai",
]);

/**
 * Normalises a raw shopper query into the canonical form we send to the
 * `search_products` RPC. Keeps the original when nothing maps, so the
 * database-side trigram/typo layer still gets a chance.
 */
export function normalizeSearchQuery(raw: string): string {
  const tokens = (raw || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);

  const mapped = tokens
    .filter((t) => !STOPWORDS.has(t) || tokens.length === 1)
    .map((t) => SYNONYMS[t] || t);

  const out = Array.from(new Set(mapped)).join(" ").trim();
  return out || (raw || "").trim();
}

/** Cheap "did you mean" — returns a corrected query when synonyms changed it. */
export function didYouMean(raw: string): string | null {
  const normalized = normalizeSearchQuery(raw);
  const cleaned = (raw || "").trim().toLowerCase().replace(/\s+/g, " ");
  return normalized && normalized !== cleaned ? normalized : null;
}

/* ── Recent searches (localStorage, per store) ───────────────────────── */

const RECENT_KEY = "sf_recent_searches";
const RECENT_MAX = 8;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((s) => typeof s === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecentSearch(q: string) {
  const term = (q || "").trim();
  if (term.length < 2) return;
  try {
    const list = getRecentSearches().filter((s) => s.toLowerCase() !== term.toLowerCase());
    list.unshift(term);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {}
}

export function clearRecentSearches() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {}
}
