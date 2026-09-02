---
name: chunk-recovery-loop
description: Why storefronts auto-refreshed every ~2s (?__r= loop) and the permanent guard
type: constraint
---
The `?__r=` reload loop was caused by the chunk-recovery attempt counter living ONLY in
sessionStorage. FB/IG in-app browsers and private mode block it, so every reload read
attempts=0 → reloaded again forever, and the old `catch { window.location.reload() }`
fallback reloaded blind.

Permanent rule (src/lib/chunkLoadRecovery.ts):
- Attempt counter must be readable from the `__r=<ts>-<attempt>` URL param + `sb_chunk_recovery`
  cookie + sessionStorage; highest wins. Never rely on storage alone.
- Never call window.location.reload() from an error/catch path. If the counter can't be read,
  refuse to navigate.
- MAX_RECOVERY_ATTEMPTS = 2. When exhausted, ErrorBoundary must render the error UI
  (`hasRecoveryBudget()`), not swallow the error.
