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
  // sessionStorage can throw (Safari private mode, in-app browsers with
  // storage blocked, quota). It MUST never be the only place the attempt
  // counter lives — see readAttemptsFromUrl/cookie below.
  try {
    sessionStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(state));
    sessionStorage.removeItem(LEGACY_RECOVERY_STORAGE_KEY);
  } catch {
    /* storage blocked — URL + cookie carry the counter */
  }
  writeRecoveryCookie(state.attempts);
}

/* ------------------------------------------------------------------ *
 * Storage-independent attempt counters
 *
 * Root cause of the "site refreshes every 2 seconds" reports: the attempt
 * counter lived ONLY in sessionStorage. Facebook / Instagram in-app
 * browsers and private mode can block or wipe it, so every reload read
 * `attempts = 0`, incremented to 1, reloaded again → endless loop that
 * burns ad spend and kills the customer journey.
 *
 * Now the counter is carried in three places; the highest one wins:
 *   1. the `__r=<ts>-<attempt>` query param (survives everything)
 *   2. a short-lived cookie (survives a URL cleanup)
 *   3. sessionStorage (best-effort, as before)
 * ------------------------------------------------------------------ */

const RECOVERY_COOKIE = "sb_chunk_recovery";

function writeRecoveryCookie(attempts: number) {
  try {
    const maxAge = Math.round(RECOVERY_COOLDOWN_MS / 1000);
    document.cookie = `${RECOVERY_COOKIE}=${attempts}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
  } catch {
    /* cookies blocked — URL still carries the counter */
  }
}

function clearRecoveryCookie() {
  try {
    document.cookie = `${RECOVERY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

function readRecoveryCookie(): number {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${RECOVERY_COOKIE}=(\\d+)`));
    return m ? Number(m[1]) || 0 : 0;
  } catch {
    return 0;
  }
}

/** `__r=<base36 ts>-<attempt>` — set by the previous recovery navigation. */
function readAttemptsFromUrl(): number {
  try {
    const raw = new URL(window.location.href).searchParams.get("__r");
    if (!raw) return 0;
    const m = raw.match(/-(\d+)$/);
    return m ? Number(m[1]) || 0 : 1;
  } catch {
    return 0;
  }
}

/** Highest attempt count from any surviving source. */
function readAttempts(signature: string, now: number): number {
  const state = readRecoveryState();
  const fromStorage =
    state && state.signature === signature && now - state.ts < RECOVERY_COOLDOWN_MS ? state.attempts : 0;
  return Math.max(fromStorage, readRecoveryCookie(), readAttemptsFromUrl());
}


export function clearChunkLoadRecoveryState() {
  if (typeof window === "undefined") return;
  clearRecoveryCookie();
  try {
    sessionStorage.removeItem(RECOVERY_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_RECOVERY_STORAGE_KEY);
  } catch {
    // Ignore storage access failures.
  }
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has("__r")) {
      url.searchParams.delete("__r");
      const nextSearch = url.searchParams.toString();
      const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`;
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  } catch {
    // Ignore history failures.
  }
}

function hasActiveRecoveryContext() {
  if (typeof window === "undefined") return false;

  try {
    return readAttempts(getRecoverySignature(), Date.now()) > 0;
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

  const now = Date.now();
  let signature = "";
  let attempts = MAX_RECOVERY_ATTEMPTS + 1;

  try {
    signature = getRecoverySignature();
    attempts = readAttempts(signature, now) + 1;
  } catch {
    // If we cannot even read the counter, refuse to navigate. A blind reload
    // here is exactly what produced the 2-second refresh loop.
    recoveryNavigationStarted = true;
    return false;
  }

  if (attempts > MAX_RECOVERY_ATTEMPTS) {
    // Budget exhausted: stop reloading and let the error boundary render.
    // Keep the marker for the cooldown window so a later chunk error in the
    // same session cannot restart the cycle.
    writeRecoveryState({ attempts: MAX_RECOVERY_ATTEMPTS, signature, ts: now });
    recoveryNavigationStarted = true;
    return false;
  }

  writeRecoveryState({ attempts, signature, ts: now });
  recoveryNavigationStarted = true;

  try {
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("__sb_heal");
    nextUrl.searchParams.delete("__sh");
    // The attempt number rides in the URL so the counter survives blocked
    // storage (FB/IG in-app browsers, private mode).
    nextUrl.searchParams.set("__r", `${now.toString(36)}-${attempts}`);
    notifyShellBroken("chunk", () => window.location.replace(nextUrl.toString()));
  } catch {
    return false;
  }
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