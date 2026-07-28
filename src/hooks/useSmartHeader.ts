import { useSmartChrome } from "./useSmartChrome";

/**
 * Returns `visible` — true when header should show, false when hidden.
 * Thin wrapper kept for existing call sites; all logic now lives in
 * `useSmartChrome` so the header and bottom nav stay in sync.
 */
export function useSmartHeader() {
  return useSmartChrome().headerVisible;
}
