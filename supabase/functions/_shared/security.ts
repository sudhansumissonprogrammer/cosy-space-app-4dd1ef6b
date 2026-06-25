// Shared security helpers for edge functions.
//
// - timingSafeEqual: constant-time string comparison to defeat timing oracles
//   on HMAC/signature checks.
// - corsAllowlist / buildCors: per-request CORS headers that echo only known
//   trusted origins instead of "*".

/** Constant-time comparison of two same-encoding strings. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return r === 0;
}

// Trusted origin matchers. Add more here when new public hosts come online.
const ORIGIN_MATCHERS: Array<RegExp> = [
  /^https?:\/\/localhost(?::\d+)?$/i,
  /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i,
  /^https:\/\/([a-z0-9-]+\.)?shopbanao\.in$/i,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/i,
  /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/i,
  /^https:\/\/([a-z0-9-]+\.)*lovable\.dev$/i,
];

/** Returns the request origin if it matches our allowlist, else null. */
export function matchAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  return ORIGIN_MATCHERS.some((rx) => rx.test(origin)) ? origin : null;
}

/**
 * Build per-request CORS headers. Echoes the Origin only if it is on the
 * allowlist; otherwise omits the ACAO header entirely so the browser blocks.
 * Always sets `Vary: Origin` so caches don't pollute.
 */
export function buildCors(req: Request, opts?: { allowCredentials?: boolean }): Record<string, string> {
  const origin = matchAllowedOrigin(req.headers.get("Origin"));
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    if (opts?.allowCredentials) headers["Access-Control-Allow-Credentials"] = "true";
  }
  return headers;
}

/** First 12-byte magic-number sniff for upload safety. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  // GIF: 47 49 46 38 (37|39) 61
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return "image/gif";
  // WEBP: RIFF....WEBP
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  // MP4 ISO BMFF: ....ftyp
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "video/mp4";
  // WebM/Matroska: 1A 45 DF A3
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "video/webm";
  return null;
}

/** Verify Meta (Facebook/WhatsApp) X-Hub-Signature-256 header. */
export async function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string): Promise<boolean> {
  if (!header || !appSecret) return false;
  const expected = header.startsWith("sha256=") ? header.slice(7) : header;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(hex, expected.toLowerCase());
}
