/** Cached negative results must defer to the fresh lookup. */
export function readPdpRpcResult<T>(result: { data: T; error?: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

export async function resolvePdpPayload<T extends { product?: unknown }>(edge: T | null | undefined, fresh: Promise<T | null | undefined>): Promise<T | null | undefined> {
  return edge?.product ? edge : await fresh;
}
