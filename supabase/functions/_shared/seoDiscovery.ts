/** Bounded discovery helpers shared by public SEO renderers. */
export const DISCOVERY_PAGE_SIZE = 20;

export function discoveryPage(raw: string | null): number | null {
  if (raw === null || raw === "") return 1;
  if (!/^[1-9]\d*$/.test(raw)) return null;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page <= 100000 ? page : null;
}

export function discoveryUrl(base: string, page: number): string {
  return page === 1 ? base : `${base}?page=${page}`;
}

/** Query errors must never masquerade as a complete, empty catalogue. */
export async function readAllRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error?: unknown }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const result = await fetchPage(from, from + 499);
    if (result.error) throw new Error("Catalogue retrieval failed");
    const page = result.data || [];
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

export function productImageUrls(primary: string | null | undefined, gallery: string[] = []): string[] {
  return [...new Set([...(primary || "").split(",").map(u => u.trim()), ...gallery])]
    .filter(u => /^https?:\/\//i.test(u)).slice(0, 10);
}

/** Only page-specific authoritative timestamps belong in lastmod. */
export function sitemapLastmod(timestamp?: string | null): string {
  if (!timestamp || !/^\d{4}-\d{2}-\d{2}(T|$)/.test(timestamp) || Number.isNaN(Date.parse(timestamp))) return "";
  return `<lastmod>${timestamp.slice(0, 10)}</lastmod>`;
}