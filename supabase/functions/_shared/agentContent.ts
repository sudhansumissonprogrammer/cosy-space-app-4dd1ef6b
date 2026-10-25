/** HTML stays the default; explicit acceptable Markdown must win negotiation. */
export function prefersMarkdown(accept: string | null): boolean {
  const ranges = (accept || "").toLowerCase().split(",").map(value => {
    const [type, ...params] = value.trim().split(";");
    const raw = params.map(p => p.trim()).find(p => p.startsWith("q="))?.slice(2);
    const q = raw === undefined ? 1 : Number(raw);
    return { type, q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
  });
  const markdown = ranges.find(r => r.type === "text/markdown");
  if (!markdown || markdown.q === 0) return false;
  const html = ranges.find(r => r.type === "text/html") || ranges.find(r => r.type === "text/*") || ranges.find(r => r.type === "*/*");
  return markdown.q >= (html?.q || 0);
}