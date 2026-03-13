import { useState, useCallback, useRef } from "react";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60_000; // 1 minute
const ATTEMPT_WINDOW_MS = 300_000; // 5 minutes

interface RateLimitState {
  isLocked: boolean;
  remainingSeconds: number;
  attemptsLeft: number;
}

/**
 * Client-side login rate limiter.
 * After MAX_ATTEMPTS failed logins within ATTEMPT_WINDOW, locks out for LOCKOUT_DURATION.
 */
export function useLoginRateLimit() {
  const attemptsRef = useRef<number[]>([]);
  const lockUntilRef = useRef<number>(0);
  const [state, setState] = useState<RateLimitState>({
    isLocked: false,
    remainingSeconds: 0,
    attemptsLeft: MAX_ATTEMPTS,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startCountdown = useCallback((until: number) => {
    clearTimer();
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (remaining <= 0) {
        clearTimer();
        attemptsRef.current = [];
        setState({ isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS });
      } else {
        setState((s) => ({ ...s, isLocked: true, remainingSeconds: remaining }));
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  /** Call before attempting login. Returns true if allowed, false if rate-limited. */
  const checkCanAttempt = useCallback((): boolean => {
    const now = Date.now();

    if (now < lockUntilRef.current) {
      return false;
    }

    // Prune old attempts outside the window
    attemptsRef.current = attemptsRef.current.filter(
      (t) => now - t < ATTEMPT_WINDOW_MS
    );

    return true;
  }, []);

  /** Call after a failed login attempt. */
  const recordFailedAttempt = useCallback(() => {
    const now = Date.now();
    attemptsRef.current.push(now);

    const recentAttempts = attemptsRef.current.filter(
      (t) => now - t < ATTEMPT_WINDOW_MS
    );
    attemptsRef.current = recentAttempts;

    const left = Math.max(0, MAX_ATTEMPTS - recentAttempts.length);
    setState((s) => ({ ...s, attemptsLeft: left }));

    if (recentAttempts.length >= MAX_ATTEMPTS) {
      const lockUntil = now + LOCKOUT_DURATION_MS;
      lockUntilRef.current = lockUntil;
      startCountdown(lockUntil);
    }
  }, [startCountdown]);

  /** Call after a successful login to reset state. */
  const resetAttempts = useCallback(() => {
    clearTimer();
    attemptsRef.current = [];
    lockUntilRef.current = 0;
    setState({ isLocked: false, remainingSeconds: 0, attemptsLeft: MAX_ATTEMPTS });
  }, []);

  return {
    ...state,
    checkCanAttempt,
    recordFailedAttempt,
    resetAttempts,
  };
}
