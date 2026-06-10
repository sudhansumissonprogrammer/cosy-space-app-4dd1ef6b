import { cn } from "@/lib/utils";

/**
 * Branded shimmer skeleton — replaces Tailwind's default animate-pulse
 * (jarring 0.5↔1 opacity) with a soft gradient sweep that feels intentional.
 * Auto-disabled under prefers-reduced-motion via CSS (see .skeleton-shimmer).
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("skeleton-shimmer rounded-md bg-muted/60", className)}
      {...props}
    />
  );
}

export { Skeleton };
