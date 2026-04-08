import { useNavigate } from "react-router-dom";
import { useCallback } from "react";

/**
 * Navigate with View Transitions API for morphing page transitions.
 * Falls back to normal navigation on unsupported browsers.
 */
export function useViewTransition() {
  const navigate = useNavigate();

  const navigateWithTransition = useCallback(
    (to: string, viewTransitionName?: string) => {
      const doc = document as any;
      if (doc.startViewTransition) {
        doc.startViewTransition(() => {
          navigate(to);
        });
      } else {
        navigate(to);
      }
    },
    [navigate]
  );

  return navigateWithTransition;
}
