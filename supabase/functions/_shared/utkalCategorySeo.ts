/**
 * Utkal category-page search content shared by the app and bot-render, so
 * shoppers and crawlers read identical wording. Only facts already on the
 * store are used: category names, listed product titles, COD and Rajkot dispatch.
 */
export interface SeoCategory { name: string; slug: string; meta_title?: string | null }
export interface FaqItem { question: string; answer: string }

const BRAND_RE = /^(.+?) Watch (Men|Women)$/i;

export function parseBrandCategory(name: string): { brand: string; gender: "Men" | "Women" } | null {
  const m = name.trim().match(BRAND_RE);
  if (!m) return null;
  return { brand: m[1].trim(), gender: m[2].toLowerCase() === "women" ? "Women" : "Men" };
}

/** Visible heading matching the search title; falls back to the category name. */
export function utkalCategoryHeading(cat: SeoCategory): string {
  const parsed = parseBrandCategory(cat.name);
  if (parsed) return `${parsed.brand} Watches for ${parsed.gender}`;
  return cat.name;
}

const DIALS = ["black", "blue", "white", "silver", "green", "gold", "rose gold", "brown", "grey", "red", "skeleton"];
const STRAPS: [RegExp, string][] = [[/\b(steel|metal|chain)\b/i, "metal"], [/\bleather\b/i, "leather"], [/\b(rubber|silicone)\b/i, "rubber"]];
const STYLES: [RegExp, string][] = [[/chrono/i, "chronograph-style"], [/automatic/i, "automatic-labelled"], [/digital/i, "digital"], [/skeleton/i, "skeleton-dial"]];

/** Attributes present in the listed product titles; never inferred beyond them. */
export function listedAttributes(titles: string[]): { dials: string[]; straps: string[]; styles: string[] } {
  const text = titles.join(" ").toLowerCase();
  const dials = DIALS.filter((d) => new RegExp(`\\b${d}\\b`).test(text));
  const straps = STRAPS.filter(([re]) => re.test(text)).map(([, l]) => l);
  const styles = STYLES.filter(([re]) => re.test(text)).map(([, l]) => l);
  return { dials: dials.slice(0, 5), straps, styles };
}

const list = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);

export function utkalCategoryIntro(cat: SeoCategory, titles: string[]): string | undefined {
  const parsed = parseBrandCategory(cat.name);
  if (!parsed) return undefined;
  const { brand, gender } = parsed;
  const who = gender === "Women" ? "women" : "men";
  const a = listedAttributes(titles);
  const facts: string[] = [];
  if (a.styles.length) facts.push(`${list(a.styles.slice(0, 2))} designs`);
  if (a.dials.length) facts.push(`${list(a.dials.slice(0, 3))} dials`);
  if (a.straps.length) facts.push(`${list(a.straps)} straps`);
  const look = facts.length ? ` Choose from ${list(facts)}.` : "";
  return `Browse ${brand}-style watches for ${who} at Utkal Watches.${look} COD available across India; dispatch from our Rajkot store.`;
}

export function utkalCategoryFaq(cat: SeoCategory): FaqItem[] {
  const parsed = parseBrandCategory(cat.name);
  if (!parsed) return [];
  const { brand, gender } = parsed;
  const label = `${brand} watches for ${gender.toLowerCase()}`;
  return [
    { question: `Are these genuine ${brand} watches?`, answer: `These are 1:1 inspired ${brand}-style watches.` },
    { question: `Can I pay cash on delivery for ${label}?`, answer: "Yes. Cash on delivery is available on orders across India." },
    { question: "Where are orders dispatched from?", answer: "Orders dispatch from the Utkal Watches store in Rajkot, Gujarat." },
    { question: "How do I check a watch's details?", answer: "Open the product page to see its photos, current price and available description. Movement, functions and materials can vary by model, so confirm them for the individual watch." },
  ];
}

/** Same brand other gender first, then other brands for the same gender. */
export function relatedCategories<T extends SeoCategory>(current: SeoCategory, all: T[], max = 8): T[] {
  const me = parseBrandCategory(current.name);
  if (!me) return [];
  const others = all.filter((c) => c.slug !== current.slug).map((c) => ({ c, p: parseBrandCategory(c.name) })).filter((x) => x.p);
  const sibling = others.filter((x) => x.p!.brand.toLowerCase() === me.brand.toLowerCase()).map((x) => x.c);
  const sameGender = others.filter((x) => x.p!.gender === me.gender && x.p!.brand.toLowerCase() !== me.brand.toLowerCase()).map((x) => x.c);
  return [...sibling, ...sameGender].slice(0, max);
}

export function faqPageSchema(items: FaqItem[]): Record<string, unknown> | null {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
  };
}
