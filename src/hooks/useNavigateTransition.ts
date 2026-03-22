import { useNavigate } from "react-router-dom";
import { useTransition, useCallback } from "react";

export function useNavigateTransition() {
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  const navigateWithTransition = useCallback(
    (to: string) => {
      startTransition(() => {
        navigate(to);
      });
    },
    [navigate]
  );

  return { navigate: navigateWithTransition, isPending };
}
