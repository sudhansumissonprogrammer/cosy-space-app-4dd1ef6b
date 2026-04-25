import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface FABProps {
  onClick: () => void;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
  /** Hide on desktop (md and up). Default true — FAB is mobile-only. */
  mobileOnly?: boolean;
}

/**
 * Floating Action Button — fixed bottom-right above mobile bottom nav.
 * Uses semantic primary tokens, adapts to safe-area insets.
 */
export default function FAB({
  onClick,
  label,
  icon,
  className,
  mobileOnly = true,
}: FABProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label || "Add"}
      className={cn(
        "fixed right-4 z-40 flex h-14 items-center justify-center gap-2 rounded-full bg-primary px-4 text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 hover:shadow-xl",
        // sit above mobile bottom nav (~64px) + safe area
        "bottom-[calc(env(safe-area-inset-bottom)+76px)] md:bottom-6",
        mobileOnly && "md:hidden",
        label ? "min-w-14" : "w-14",
        className,
      )}
    >
      {icon ?? <Plus className="h-6 w-6" strokeWidth={2.5} />}
      {label && <span className="text-sm font-semibold pr-1">{label}</span>}
    </button>
  );
}
