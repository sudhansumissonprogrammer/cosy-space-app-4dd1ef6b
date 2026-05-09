// Hover/focus-triggered prefetch for landing → auth navigation.
// Replaces the old idle prefetch which cost bandwidth for every visitor
// even though most never click signup/login.

let started = false;

export function prefetchAuthChunks() {
  if (started) return;
  started = true;
  Promise.all([
    import("@/components/ui/toaster"),
    import("@/components/ui/tooltip"),
    import("@/components/ui/sonner"),
    import("@/contexts/AuthContext"),
    import("@/pages/Login"),
    import("@/pages/Signup"),
    import("@/routes/AuthRoutes"),
  ]).catch(() => {});
}

/** Attach to onMouseEnter / onFocus / onTouchStart of any auth CTA. */
export const onAuthCtaIntent = {
  onMouseEnter: prefetchAuthChunks,
  onFocus: prefetchAuthChunks,
  onTouchStart: prefetchAuthChunks,
};
