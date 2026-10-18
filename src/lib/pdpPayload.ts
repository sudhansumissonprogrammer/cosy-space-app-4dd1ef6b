/** Cached negative results must defer to the fresh lookup. */
export async function resolvePdpPayload<T extends { product?: unknown }>(edge: T | null | undefined, fresh: Promise<T | null | undefined>): Promise<T | null | undefined> {
  return edge?.product ? edge : await fresh;
}
