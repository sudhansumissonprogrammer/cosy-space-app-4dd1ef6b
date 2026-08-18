/** Normalize imported product-video values and reject folder placeholders. */
export function normalizeProductVideoUrl(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Some catalogue imports prefixed an already-absolute URL one or more times.
  // Only repair a second scheme in the pathname. A scheme inside a legitimate
  // query value (e.g. ?ref=https://...) must not replace the real media URL.
  const firstSchemeEnd = trimmed.indexOf("://") + 3;
  const secondHttps = trimmed.indexOf("https://", firstSchemeEnd);
  const secondHttp = trimmed.indexOf("http://", firstSchemeEnd);
  const candidates = [secondHttps, secondHttp].filter((index) => index > 0);
  const secondScheme = candidates.length ? Math.min(...candidates) : -1;
  const queryStart = trimmed.search(/[?#]/);
  let normalized = secondScheme > 0 && (queryStart < 0 || secondScheme < queryStart)
    ? trimmed.slice(secondScheme)
    : trimmed;

  try {
    let parsed = new URL(normalized);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    // Values ending at /video_upload/ are folders, not playable media.
    if (!/\.(mp4|m4v|mov|webm)$/i.test(parsed.pathname)) return null;

    // JD serves a browser-compatible MP4 twin for imported QuickTime files.
    // Prefer it because Android WebViews and many desktop browsers cannot
    // decode the .mov container even when its underlying codec is H.264.
    if (/^(assets\.)?jdwebnship\.(com|in)$/i.test(parsed.hostname) && /\.mov$/i.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(/\.mov$/i, ".mp4");
    }
    return parsed.toString();
  } catch {
    return null;
  }
}