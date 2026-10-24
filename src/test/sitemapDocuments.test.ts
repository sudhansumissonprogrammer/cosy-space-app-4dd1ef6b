import { expect, it } from "vitest";
import { partitionSitemap, sitemapIndex } from "../../supabase/functions/_shared/sitemapDocuments";

it("splits more than 50,000 URLs without dropping or duplicating entries", () => {
  const xml = '<urlset>' + Array.from({ length: 50001 }, (_, i) => `<url><loc>https://store.example/product/${i}</loc></url>`).join('') + '</urlset>';
  const parts = partitionSitemap(xml);
  expect(parts).toHaveLength(2);
  const urls = parts.flatMap(p => [...p.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]));
  expect(urls.length).toBe(50001);
  expect(new Set(urls).size).toBe(50001);
  expect(parts.every(p => [...p.matchAll(/<url>/g)].length <= 45000)).toBe(true);
});

it("bounds UTF-8 bytes, not characters, while retaining photo URLs", () => {
  const entry = '<url><loc>https://store.example/घड़ी</loc><image:image><image:loc>https://cdn.example/original.webp</image:loc></image:image></url>';
  const parts = partitionSitemap('<urlset>' + entry.repeat(10) + '</urlset>', 45000, 600);
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.every(p => new TextEncoder().encode(p).length <= 600)).toBe(true);
  expect(parts.join('').match(/original.webp/g)).toHaveLength(10);
});

it("indexes deterministic same-store child URLs without invented dates", () => {
  expect(sitemapIndex('https://utkalwatch.in', 2)).toContain('<loc>https://utkalwatch.in/sitemap-2.xml</loc>');
  expect(sitemapIndex('https://utkalwatch.in', 2)).not.toContain('lastmod');
});