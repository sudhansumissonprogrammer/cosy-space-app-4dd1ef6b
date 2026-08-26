const RECOVERY_STORAGE_KEY = "chunk_recovery_state";
const LEGACY_RECOVERY_STORAGE_KEY = "chunk_recovery_ts";
const RECOVERY_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_RECOVERY_ATTEMPTS = 2;

type RecoveryState = {
  attempts: number;
  signature: string;
  ts: number;
};

let recoveryNavigationStarted = false;

const PRIMARY_CHUNK_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /Loading CSS chunk \d+ failed/i,
  /ChunkLoadError/i,
  // After a deploy, an old chunk path can resolve to a stale/empty module
  // → React tries to render and reads `.default` of undefined. Treat as
  // recoverable so the user sees a fresh reload, not a white error screen.
  /Cannot read propert(y|ies) of undefined \(reading ['"]default['"]\)/i,
  /Cannot destructure property ['"][^'"]+['"] of ['"]undefined['"] as it is undefined/i,
  /undefined is not an object \(evaluating .*['"]default['"]\)/i,
  // Same root cause, but for lazy imports that read a *named* export off the
  // module namespace (e.g. `m.VideoSlide`) — the namespace is undefined.
  /Cannot read propert(y|ies) of undefined \(reading ['"][A-Z][A-Za-z0-9_]*['"]\)/,

];

const FOLLOW_UP_RECOVERY_PATTERNS = [
  /Importing a module script failed/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
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
  url.searchParams.delete("__sb_heal");
  url.searchParams.delete("__sh");
  return `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
}

function notifyShellBroken(reason: string, onDone: () => void) {
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    onDone();
  };

  try {
    fetch(`/api/shell-broken?r=${encodeURIComponent(reason)}`, {
      method: "POST",
      cache: "no-store",
      keepalive: true,
    }).then(done, done);
    window.setTimeout(done, 1200);
  } catch {
    done();
  }
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
  // Several failed lazy imports can reject in the same event-loop turn. Only
  // one of them should consume an attempt and initiate navigation.
  if (recoveryNavigationStarted) return true;

  try {
    const now = Date.now();
    const signature = getRecoverySignature();
    const previous = readRecoveryState();
    const isSameRecoveryFlow = !!previous && previous.signature === signature && now - previous.ts < RECOVERY_COOLDOWN_MS;
    const attempts = isSameRecoveryFlow ? previous.attempts + 1 : 1;

    if (attempts > MAX_RECOVERY_ATTEMPTS) {
      // Keep an exhausted marker for the cooldown window. Clearing it here
      // made the next chunk error start a brand-new recovery flow, producing
      // an endless cycle of three reloads whenever the shared origin stayed
      // unavailable.
      writeRecoveryState({ attempts: MAX_RECOVERY_ATTEMPTS, signature, ts: previous?.ts || now });
      return false;
    }

    writeRecoveryState({ attempts, signature, ts: now });
    recoveryNavigationStarted = true;

    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("__sb_heal");
    nextUrl.searchParams.delete("__sh");
    nextUrl.searchParams.set("__r", `${now.toString(36)}-${attempts}`);
    notifyShellBroken("chunk", () => window.location.replace(nextUrl.toString()));
    return true;
  } catch {
    recoveryNavigationStarted = true;
    notifyShellBroken("chunk-fallback", () => window.location.reload());
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