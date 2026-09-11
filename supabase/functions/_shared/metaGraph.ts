// Single source of truth for the Meta Graph API version used by every
// Conversions API sender (browser mirror, server Purchase, verify tool).
//
// Meta supports each version for ~2 years. Pinning v21.0 (Oct 2024) in three
// separate files meant deprecation warnings on every call and a hard failure
// once the version is retired. Bump here — or set META_GRAPH_VERSION in the
// project secrets to roll forward without a code change.
export const META_GRAPH_VERSION =
  (globalThis as any)?.Deno?.env?.get?.("META_GRAPH_VERSION") || "v23.0";

export const META_GRAPH_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
