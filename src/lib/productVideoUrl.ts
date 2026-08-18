/** Normalize imported product-video values and reject folder placeholders. */
export function normalizeProductVideoUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Some catalogue imports prefixed an already-absolute URL one or more times.
  const start = Math.max(trimmed.lastIndexOf("https://"), trimmed.lastIndexOf("http://"));
  const normalized = start > 0 ? trimmed.slice(start) : trimmed;

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    // Values ending at /video_upload/ are folders, not playable media.
    if (!/\.(mp4|m4v|mov|webm)$/i.test(parsed.pathname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}