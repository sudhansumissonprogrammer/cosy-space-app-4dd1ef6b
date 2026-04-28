const RECOVERY_STORAGE_KEY = "chunk_recovery_state";
const LEGACY_RECOVERY_STORAGE_KEY = "chunk_recovery_ts";
const RECOVERY_COOLDOWN_MS = 2 * 60 * 1000;
const MAX_RECOVERY_ATTEMPTS = 3;

type RecoveryState = {
  attempts: number;
  signature: string;
  ts: number;
};

const PRIMARY_CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading CSS chunk \d+ failed/i,
  /ChunkLoadError/i,
  /Cannot destructure property ['"]default['"] of ['"]undefined['"] as it is undefined/i,
  /Cannot destructure property ['"]default['"] of undefined/i,
  /Cannot read properties of undefined \(reading ['"]default['"]\)/i,
  /_result is undefined/i,
  /reading ['"]default['"]/i,
];

const FOLLOW_UP_RECOVERY_PATTERNS = [
  /Cannot read properties of undefined \(reading ['"]default['"]\)/i,
  /Cannot read property ['"]default['"] of undefined/i,
  /does not provide an export named ['"]default['"]/i,
  /_result is undefined/i,
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

function getRecoverySignature() {
  const url = new URL(window.location.href);
  url.hash = "";
  url.searchParams.delete("__r");
  return `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
}

function readRecoveryState(): RecoveryState | null {
  try {
    const raw = sessionStorage.getItem(RECOVERY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RecoveryState>;
      if (
        typeof parsed?.attempts === "number" &&
        typeof parsed?.signature === "string" &&
        typeof parsed?.ts === "number"
      ) {
        return parsed as RecoveryState;
      }
    }

    const legacyTs = Number(sessionStorage.getItem(LEGACY_RECOVERY_STORAGE_KEY) || "0");
    if (legacyTs > 0) {
      return {
        attempts: 1,
        signature: getRecoverySignature(),
        ts: legacyTs,
      };
    }
  } catch {
    // Ignore storage parsing issues.
  }

  return null;
}

function writeRecoveryState(state: RecoveryState) {
  sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(state));
  sessionStorage.removeItem(LEGACY_RECOVERY_STORAGE_KEY);
}

export function clearChunkLoadRecoveryState() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_RECOVERY_STORAGE_KEY);

    const url = new URL(window.location.href);
    if (url.searchParams.has("__r")) {
      url.searchParams.delete("__r");
      const nextSearch = url.searchParams.toString();
      const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  } catch {
    // Ignore storage access failures.
  }
}

function hasActiveRecoveryContext() {
  if (typeof window === "undefined") return false;

  try {
    const state = readRecoveryState();
    const hasRecentState = !!state && Date.now() - state.ts < RECOVERY_COOLDOWN_MS;
    if (hasRecentState) return true;

    return false;
  } catch {
    return false;
  }
}

export function isRecoverableChunkLoadError(error: unknown): boolean {
  const message = getErrorMessage(error);
  if (PRIMARY_CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return true;
  }

  return hasActiveRecoveryContext() && FOLLOW_UP_RECOVERY_PATTERNS.some((pattern) => pattern.test(message));
}

export function recoverFromChunkLoadError(error: unknown): boolean {
  if (typeof window === "undefined" || !isRecoverableChunkLoadError(error)) return false;

  try {
    const now = Date.now();
    const signature = getRecoverySignature();
    const previous = readRecoveryState();
    const isSameRecoveryFlow = !!previous && previous.signature === signature && now - previous.ts < RECOVERY_COOLDOWN_MS;
    const attempts = isSameRecoveryFlow ? previous.attempts + 1 : 1;

    if (attempts > MAX_RECOVERY_ATTEMPTS) {
      clearChunkLoadRecoveryState();
      return false;
    }

    writeRecoveryState({ attempts, signature, ts: now });

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("__r", `${now.toString(36)}-${attempts}`);
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

  window.addEventListener("storefront:content-ready", clearChunkLoadRecoveryState);

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