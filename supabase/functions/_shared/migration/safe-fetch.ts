const MAX_REDIRECTS = 4;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
    parts[0] >= 224;
}

function isUnsafeIpv6(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb") ||
    normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
}

async function assertPublicDns(host: string): Promise<void> {
  if (isPrivateIpv4(host) || isUnsafeIpv6(host)) throw new Error("Private or local network addresses are not allowed");
  if (/^[\d.]+$/.test(host) || host.includes(":")) return;
  const records = await Promise.all([
    Deno.resolveDns(host, "A").catch(() => [] as string[]),
    Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
  ]);
  const addresses = records.flat();
  if (!addresses.length || addresses.some((address) => isPrivateIpv4(address) || isUnsafeIpv6(address))) {
    throw new Error("Website address did not resolve to a public server");
  }
}

export function assertSafePublicUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error("Enter a valid public website URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Only public website URLs are supported");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host === "metadata.google.internal" || isPrivateIpv4(host) || isUnsafeIpv6(host)) {
    throw new Error("Private or local network addresses are not allowed");
  }
  url.username = "";
  url.password = "";
  return url;
}

export async function safeFetch(
  value: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; maxBytes?: number; allowedHost?: string } = {},
): Promise<Response> {
  let url = assertSafePublicUrl(value);
  const allowedHost = options.allowedHost?.toLowerCase() || url.hostname.toLowerCase();
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    if (url.hostname.toLowerCase() !== allowedHost) throw new Error("Cross-domain redirects are not allowed");
    await assertPublicDns(url.hostname.toLowerCase());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetch(url, { ...init, redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("Too many redirects");
      url = assertSafePublicUrl(new URL(location, url).toString());
      continue;
    }
    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new Error("Remote response is too large");
    return response;
  }
  throw new Error("Could not fetch the public website");
}

export async function readLimitedText(response: Response, maxBytes = DEFAULT_MAX_BYTES): Promise<string> {
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > maxBytes) throw new Error("Remote response is too large");
  return new TextDecoder().decode(bytes);
}