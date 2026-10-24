const HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
const FOOTER = '\n</urlset>';
// Conservative headroom below Google's 50,000 URL / 50 MiB limits.
export const SITEMAP_MAX_URLS = 45000;
export const SITEMAP_MAX_BYTES = 45 * 1024 * 1024;

export function partitionSitemap(xml: string, maxUrls = SITEMAP_MAX_URLS, maxBytes = SITEMAP_MAX_BYTES): string[] {
  const encoder = new TextEncoder();
  const overhead = encoder.encode(HEADER + FOOTER).length;
  const documents: string[] = [];
  let entries: string[] = [];
  let bytes = overhead;
  for (const match of xml.matchAll(/<url>[\s\S]*?<\/url>/g)) {
    const entry = match[0];
    const size = encoder.encode(entry + '\n').length;
    if (size + overhead > maxBytes) throw new Error("A sitemap entry exceeds the document size limit");
    if (entries.length && (entries.length >= maxUrls || bytes + size > maxBytes)) {
      documents.push(HEADER + entries.join('\n') + FOOTER);
      entries = [];
      bytes = overhead;
    }
    entries.push(entry);
    bytes += size;
  }
  if (entries.length || !documents.length) documents.push(HEADER + entries.join('\n') + FOOTER);
  return documents;
}

export function sitemapIndex(base: string, count: number): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    Array.from({ length: count }, (_, index) => `<sitemap><loc>${base}/sitemap-${index + 1}.xml</loc></sitemap>`).join('\n') + '\n</sitemapindex>';
}