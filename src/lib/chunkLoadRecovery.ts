const RECOVERY_STORAGE_KEY = "chunk_recovery_ts";
const RECOVERY_COOLDOWN_MS = 2 * 60 * 1000;

const CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading CSS chunk \d+ failed/i,
  /ChunkLoadError/i,
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return `${error.name} ${error.message}`.trim();
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined;
    if (typeof maybeMessage === "string") return maybeMessage;
  }
  return String(error || "");
}

export function isRecoverableChunkLoadError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export function recoverFromChunkLoadError(error: unknown): boolean {
  if (typeof window === "undefined" || !isRecoverableChunkLoadError(error)) return false;

  try {
    const lastAttempt = Number(sessionStorage.getItem(RECOVERY_STORAGE_KEY) || "0");
    // Within cooldown: still report "handled" so ErrorBoundary doesn't show
    // the broken UI for a second chunk error while the first reload is pending.
    if (Date.now() - lastAttempt < RECOVERY_COOLDOWN_MS) return true;

    sessionStorage.setItem(RECOVERY_STORAGE_KEY, String(Date.now()));

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("__r", Date.now().toString(36));
    window.location.replace(nextUrl.toString());
    return true;
  } catch {
    window.location.reload();
    return true;
  }
}

export function installChunkLoadRecovery() {
  if (typeof window === "undefined") return;
  if ((window as Window & { __chunkRecoveryInstalled?: boolean }).__chunkRecoveryInstalled) return;

  (window as Window & { __chunkRecoveryInstalled?: boolean }).__chunkRecoveryInstalled = true;

  window.addEventListener("vite:preloadError", (event: Event) => {
    const preloadEvent = event as Event & { payload?: unknown; preventDefault?: () => void };
    if (recoverFromChunkLoadError(preloadEvent.payload)) {
      preloadEvent.preventDefault?.();
    }
  });

  window.addEventListener("error", (event) => {
    const errorEvent = event as ErrorEvent;
    recoverFromChunkLoadError(errorEvent.error || errorEvent.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const rejectionEvent = event as PromiseRejectionEvent;
    recoverFromChunkLoadError(rejectionEvent.reason);
  });
}