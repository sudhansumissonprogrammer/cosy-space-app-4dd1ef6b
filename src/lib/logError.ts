/**
 * Centralized error logging utility.
 * Sends errors to the backend edge function for persistent tracking.
 * Fire-and-forget — never blocks UI or throws.
 */

const LOG_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest?type=error`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Throttle: max 10 errors per minute to prevent spam
let errorCount = 0;
let resetTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_ERRORS_PER_MINUTE = 10;

/**
 * Known noisy errors from in-app browsers (Facebook/Instagram WebView, iOS WKWebView,
 * third-party extensions, cross-origin scripts). These are NOT bugs in our code —
 * they originate from the host app's injected JS and would just spam our logs.
 */
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  /_AutofillCallbackHandler/i,           // FB/IG iOS WebView autofill bridge
  /window\.webkit\.messageHandlers/i,    // iOS WKWebView native bridge
  /^Script error\.?$/i,                   // Cross-origin script (no details available)
  /Non-Error promise rejection captured/i,
  /ResizeObserver loop limit exceeded/i,
  /ResizeObserver loop completed with undelivered notifications/i,
  /Java exception was raised during method invocation/i, // Android WebView
  /__gCrWeb/i,                            // Chrome iOS WebView bridge
  /instantSearchSDKJSBridgeClearHighlight/i, // Bing app WebView
  /webkitExitFullScreen/i,                // Safari fullscreen quirks
];

function isIgnoredError(message: string, stack?: string): boolean {
  const haystack = `${message} ${stack || ""}`;
  return IGNORED_ERROR_PATTERNS.some((rx) => rx.test(haystack));
}

interface LogErrorOptions {
  message: string;
  context?: string; // e.g. "CartContext", "CheckoutPage", "ErrorBoundary"
  stack?: string;
  level?: "error" | "warn" | "info";
  metadata?: Record<string, unknown>;
}

export function logError(options: LogErrorOptions): void {
  try {
    // Throttle check
    if (errorCount >= MAX_ERRORS_PER_MINUTE) return;
    errorCount++;
    if (!resetTimer) {
      resetTimer = setTimeout(() => {
        errorCount = 0;
        resetTimer = null;
      }, 60_000);
    }

    // Strip sensitive data from stack traces
    const sanitizedStack = options.stack
      ?.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, "Bearer [REDACTED]")
      ?.replace(/eyJ[A-Za-z0-9\-._]+/g, "[JWT_REDACTED]")
      ?.slice(0, 2000); // Cap stack length

    const payload = {
      message: options.message?.slice(0, 500) || "Unknown error",
      context: options.context?.slice(0, 100),
      stack: sanitizedStack,
      level: options.level || "error",
      url: window.location.href?.slice(0, 500),
      user_agent: navigator.userAgent?.slice(0, 300),
      metadata: options.metadata,
    };

    // Fire and forget — never await, never block
    fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": ANON_KEY,
      },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Silently fail — logging should never crash the app
    });
  } catch {
    // Ultimate safety net — logging must never throw
  }
}

/**
 * Helper to log errors from catch blocks.
 * Usage: catch (err) { logCaughtError(err, "MyComponent") }
 */
export function logCaughtError(err: unknown, context: string, metadata?: Record<string, unknown>): void {
  const error = err instanceof Error ? err : new Error(String(err));
  logError({
    message: error.message,
    stack: error.stack,
    context,
    metadata,
  });
}

/**
 * Global unhandled error/rejection listeners.
 * Call once at app startup.
 */
export function initGlobalErrorHandlers(): void {
  window.addEventListener("error", (event) => {
    logError({
      message: event.message || "Unhandled error",
      stack: event.error?.stack,
      context: "window.onerror",
      metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason || "Unhandled rejection");
    const stack = reason instanceof Error ? reason.stack : undefined;
    logError({
      message,
      stack,
      context: "unhandledrejection",
    });
  });
}
