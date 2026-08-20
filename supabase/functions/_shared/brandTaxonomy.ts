// supabase/functions/_shared/brandTaxonomy.ts
//
// Brand + product-type taxonomy used to auto-build "<Brand> <Type> <Gender>"
// categories (e.g. "Rolex Watch Men", "Diesel Denim Men").
//
// Source catalogs (JD / Cartpe) deliberately obfuscate brand names
// ("Roleex", "Tisso_t", "Radd_o", "Tag_g heuuer"), so matching is done on a
// NORMALISED form: lowercase → strip non-letters → collapse repeated letters.
// Adjacent token pairs/triples are also joined so "Tag_Heuer" and "Rad_o"
// resolve as one brand.

/** lowercase, letters only, repeated letters collapsed ("tissoot" → "tisot"). */
export function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1");
}

/** Canonical brand → alias list (aliases are normalised at load time). */
const BRAND_ALIASES: Record<string, string[]> = {
  "Rolex": ["rolex", "rolx"],
  "Tissot": ["tissot", "tisot"],
  "Rado": ["rado", "rad"],
  "Omega": ["omega", "omeg"],
  "Seiko": ["seiko", "seik"],
  "Casio": ["casio", "edifice"],
  "G-Shock": ["gshock", "gshok"],
  "Tag Heuer": ["tagheuer", "heuer", "heue", "carrera"],
  "Fossil": ["fossil", "fosil", "fosi"],
  "Hublot": ["hublot", "hublo"],
  "Patek Philippe": ["patekphilippe", "patek", "pate", "philippe", "philipe", "philip", "nautilus"],
  "Audemars Piguet": ["audemars", "piguet", "ap"],
  "Richard Mille": ["richardmille", "richard", "mille", "mile"],
  "Cartier": ["cartier", "cartie"],
  "Armani": ["armani", "arman", "arma", "emporio", "emporioarmani"],
  "Tommy Hilfiger": ["tommy", "tomy", "hilfiger", "hilfige"],
  "Diesel": ["diesel", "diese"],
  "Gucci": ["gucci", "guci", "guc"],
  "Louis Vuitton": ["louisvuitton", "vuitton", "vuiton", "louis", "loui"],
  "Burberry": ["burberry", "burbery", "burber"],
  "Versace": ["versace", "versac"],
  "Prada": ["prada"],
  "Balmain": ["balmain", "balmai"],
  "Loewe": ["loewe"],
  "Amiri": ["amiri", "amir"],
  "Zara": ["zara", "zar"],
  "Ralph Lauren": ["ralphlauren", "ralph", "lauren", "laure"],
  "Nike": ["nike", "nik", "airforce"],
  "Adidas": ["adidas", "adida"],
  "Puma": ["puma", "pum"],
  "Jordan": ["jordan", "airjordan"],
  "New Balance": ["newbalance"],
  "Lacoste": ["lacoste", "lacost"],
  "Hugo Boss": ["hugoboss", "hugo", "boss", "bos"],
  "Calvin Klein": ["calvinklein", "calvin", "klein"],
  "Michael Kors": ["michaelkors", "kors"],
  "Guess": ["guess", "gues"],
  "Ray-Ban": ["rayban"],
  "Swatch": ["swatch"],
  "Bvlgari": ["bvlgari", "bulgari"],
  "Vacheron Constantin": ["vacheron", "constantin"],
  "Jacob & Co": ["jacob"],
  "Maserati": ["maserati"],
  "Titan": ["titan"],
  "Fendi": ["fendi", "fend"],
  "Onitsuka Tiger": ["onitsuka"],
  "Hackett": ["hackett", "hacket"],
  "Tudor": ["tudor"],
  "Breitling": ["breitling", "breitlin"],
  "Montblanc": ["montblanc"],
  "Hermes": ["hermes", "herme"],
  "Dior": ["dior"],
  "Balenciaga": ["balenciaga"],
  "Levis": ["levis", "levi"],
};

/** normalised alias → canonical brand (longest alias wins on ties). */
const ALIAS_MAP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [brand, aliases] of Object.entries(BRAND_ALIASES)) {
    for (const a of aliases) {
      const k = norm(a);
      if (!k) continue;
      if (!m.has(k)) m.set(k, brand);
    }
  }
  return m;
})();

/**
 * Detect the brand of a product from its (obfuscated) title.
 * Returns null when no confident match exists.
 */
export function detectBrand(name: string): string | null {
  const tokens = name
    .split(/[^A-Za-z]+/)
    .map((t) => norm(t))
    .filter(Boolean);
  if (!tokens.length) return null;

  let best: { brand: string; len: number } | null = null;
  const consider = (key: string) => {
    const brand = ALIAS_MAP.get(key);
    if (brand && (!best || key.length > best.len)) best = { brand, len: key.length };
  };

  for (let i = 0; i < tokens.length; i++) {
    consider(tokens[i]);
    if (i + 1 < tokens.length) consider(tokens[i] + tokens[i + 1]);
    if (i + 2 < tokens.length) consider(tokens[i] + tokens[i + 1] + tokens[i + 2]);
  }
  // 2-letter aliases (e.g. "ap") are only trusted as standalone tokens.
  if (best && best.len < 3) {
    const ok = tokens.some((t) => t === norm(Object.keys(ALIAS_MAP).find((k) => ALIAS_MAP.get(k) === best!.brand && k.length < 3) || ""));
    if (!ok) return null;
  }
  return best ? best.brand : null;
}

export type Taxon = { type: string; gender: "Men" | "Women" | "" };

/**
 * Map an existing (source) category name to a product type + gender.
 * Returns null for categories we do not want to brand-split (sale, etc.).
 */
export function taxonOf(categoryName: string): Taxon | null {
  const c = categoryName.toLowerCase();

  let gender: Taxon["gender"] = "";
  if (/\b(women|woman|womens|women's|ladies|lady|her|female)\b/.test(c) || /women|ladies/.test(c)) gender = "Women";
  else if (/men|male|his|him|gents/.test(c)) gender = "Men";

  const t = (type: string, g?: Taxon["gender"]): Taxon => ({ type, gender: g ?? gender });

  if (/watch/.test(c)) return t("Watch");
  if (/sunglass|shades/.test(c)) return t("Sunglasses");
  if (/frame/.test(c)) return t("Frames");
  if (/t-?shirt|tshirt/.test(c)) return t("T-Shirt");
  if (/shirt/.test(c)) return t("Shirt");
  if (/denim|jean/.test(c)) return t("Denim");
  if (/hoodie/.test(c)) return t("Hoodie");
  if (/sweatshirt/.test(c)) return t("Sweatshirt");
  if (/track ?suit/.test(c)) return t("Track Suit");
  if (/track ?pant/.test(c)) return t("Track Pant");
  if (/trouser/.test(c)) return t("Trouser");
  if (/cargo/.test(c)) return t("Cargo");
  if (/short/.test(c)) return t("Shorts");
  if (/jacket/.test(c)) return t("Jacket");
  if (/shoe|sneaker|trainer/.test(c)) return t("Shoes");
  if (/flip ?flop|slide/.test(c)) return t("Slides");
  if (/belt ?wallet|combo/.test(c)) return t("Belt & Wallet Combo");
  if (/belt/.test(c)) return t("Belt");
  if (/wallet/.test(c)) return t("Wallet");
  if (/handbag/.test(c)) return t("Handbag", "Women");
  if (/sling/.test(c)) return t("Sling Bag");
  if (/duffel/.test(c)) return t("Duffel Bag");
  if (/laptop bag/.test(c)) return t("Laptop Bag");
  if (/bagpack|backpack/.test(c)) return t("Backpack");
  if (/cap\b|caps/.test(c)) return t("Cap");

  return null; // sale / misc buckets are skipped
}

/** Refine gender using signals in the product title itself. */
export function refineGender(name: string, base: Taxon["gender"]): Taxon["gender"] {
  const n = name.toLowerCase();
  if (/\b(women|womens|woman|ladies|lady|girl|her)\b/.test(n)) return "Women";
  if (base) return base;
  if (/\b(men|mens|man|gents|boy|his)\b/.test(n)) return "Men";
  return "";
}

export function brandCategoryName(brand: string, tax: Taxon, name: string): string {
  const gender = refineGender(name, tax.gender);
  return `${brand} ${tax.type}${gender ? " " + gender : ""}`;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Generated brand categories are tagged by this display_order floor. */
export const BRAND_CAT_ORDER_BASE = 1000;
