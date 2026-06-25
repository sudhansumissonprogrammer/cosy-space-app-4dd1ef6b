// Shared HTTP helper: fetch with timeout + small retry policy for transient
// network errors. Keeps payment + WhatsApp + Meta API calls from hanging the
// edge function past the 60s wall, and avoids one-off blip failures.
//
// Behaviour:
// - timeoutMs (default 10s) cancels the request via AbortController.
// - For idempotent methods (GET/HEAD) and only when no body is supplied, a
//   single retry is attempted on network-level errors (NOT on HTTP 4xx/5xx,
//   which the caller must decide how to handle).
// - Caller's own `signal` is honoured: if it aborts, no retry happens.

export interface FetchWithTimeoutOptions extends RequestInit {
  timeoutMs?: number;
  // Force-allow retries on POST when the caller knows the endpoint is
  // idempotent (e.g. Razorpay capture which is idempotent on payment id).
  retryOnNetworkError?: boolean;
}

export async function fetchWithTimeout(
  input: string | URL,
  init: FetchWithTimeoutOptions = {},
): Promise<Response> {
  const { timeoutMs = 10_000, retryOnNetworkError, signal: callerSignal, ...rest } = init;
  const method = (rest.method ?? "GET").toUpperCase();
  const canRetry =
    retryOnNetworkError === true ||
    (retryOnNetworkError !== false && (method === "GET" || method === "HEAD"));

  const attempt = async (): Promise<Response> => {
    const ctrl = new AbortController();
    const onCallerAbort = () => ctrl.abort((callerSignal as AbortSignal)?.reason);
    if (callerSignal) {
      if (callerSignal.aborted) ctrl.abort(callerSignal.reason);
      else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
    }
    const t = setTimeout(() => ctrl.abort(new Error(`fetch timed out after ${timeoutMs}ms`)), timeoutMs);
    try {
      return await fetch(input, { ...rest, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
      if (callerSignal) callerSignal.removeEventListener("abort", onCallerAbort);
    }
  };

  try {
    return await attempt();
  } catch (err) {
    // Don't retry if the caller aborted, or this was our timeout — surface it.
    const aborted = (err as { name?: string })?.name === "AbortError";
    if (!canRetry || aborted) throw err;
    // Single retry with small jitter.
    await new Promise((r) => setTimeout(r, 250 + Math.floor(Math.random() * 250)));
    return await attempt();
  }
}
