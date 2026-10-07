import manifest from "@/assets/storefront-thumbnails/manifest.json";

const thumbnails: Readonly<Record<string, string>> = manifest;

/** Only explicit, successfully uploaded copies are eligible. Never guess paths. */
export function verifiedThumbnail(url: string, resolvedUrl: string, width: number): string | undefined {
  if (width > 320 || width <= 0) return undefined;
  const asset = thumbnails[url] || thumbnails[resolvedUrl];
  // The public asset origin also works in local preview (which has no asset proxy).
  return asset ? new URL(asset, "https://cosy-space-app.lovable.app").href : undefined;
}