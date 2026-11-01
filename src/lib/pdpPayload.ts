/** Cached negative results must defer to the fresh lookup. */
export function readPdpRpcResult<T>(result: { data: T; error?: unknown }): T {
  if (result.error) throw result.error;
  return result.data;
}

export async function resolvePdpPayload<T extends { product?: unknown }>(edge: T | null | undefined, fresh: Promise<T | null | undefined>): Promise<T | null | undefined> {
  return edge?.product ? edge : await fresh;
}

/** Neither a cached miss nor a failed request may beat a valid product. */
export function firstValidPdpPayload<T extends { product?: unknown }>(edge: Promise<T | null | undefined>, fresh: Promise<T | null | undefined>): Promise<T | null | undefined> {
  return new Promise((resolve, reject) => {
    let remaining = 2;
    let fallback: T | null | undefined;
    let failure: unknown;
    let succeeded = false;
    const settle = () => {
      remaining -= 1;
      if (remaining === 0) {
        if (!succeeded && failure) reject(failure);
        else resolve(fallback);
      }
    };
    for (const source of [edge, fresh]) {
      source.then((payload) => {
        succeeded = true;
        if (payload?.product) resolve(payload);
        else if (payload !== undefined) fallback = payload;
        settle();
      }, (error: unknown) => { failure = error; settle(); });
    }
  });
}
