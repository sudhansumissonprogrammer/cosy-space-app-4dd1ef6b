/**
 * Direct R2 uploader for backend workers (no user JWT required).
 */
import { AwsClient } from "npm:aws4fetch@1.0.20";
import { assertSafePublicUrl, safeFetch } from "./safe-fetch.ts";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID") || "";
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID") || "";
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY") || "";
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME") || "";
const R2_PUBLIC_URL = (Deno.env.get("R2_PUBLIC_URL") || "").replace(/\/+$/, "");

const r2Ready = !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME && R2_PUBLIC_URL);

const r2 = r2Ready
  ? new AwsClient({
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    })
  : null;

const endpoint = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET_NAME}`;

export async function mirrorImageToR2(
  sourceUrl: string,
  keyPath: string,
): Promise<string | null> {
  if (!r2Ready || !r2) {
    console.warn("[migration/r2] R2 not configured, skipping mirror");
    return null;
  }
  try {
    const allowedHost = assertSafePublicUrl(sourceUrl).hostname;
    const src = await safeFetch(sourceUrl, {}, { timeoutMs: 20_000, maxBytes: 12 * 1024 * 1024, allowedHost });
    if (!src.ok) throw new Error(`fetch ${sourceUrl} -> ${src.status}`);
    const buf = new Uint8Array(await src.arrayBuffer());
    if (buf.byteLength > 12 * 1024 * 1024) throw new Error("image is too large");
    const contentType = src.headers.get("content-type") || "image/jpeg";

    const res = await r2.fetch(`${endpoint}/${keyPath}`, {
      method: "PUT",
      body: buf,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    if (!res.ok) throw new Error(`R2 PUT ${res.status} ${await res.text()}`);
    await res.text();
    return `${R2_PUBLIC_URL}/${keyPath}`;
  } catch (err) {
    console.warn(`[migration/r2] mirror failed for ${sourceUrl}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export function extFromUrl(url: string, fallback = "jpg"): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\.([a-zA-Z0-9]{2,5})(?:$|\?)/);
    return (m?.[1] || fallback).toLowerCase();
  } catch {
    return fallback;
  }
}
