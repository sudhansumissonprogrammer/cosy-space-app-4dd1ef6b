import React from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  pull: number;
  refreshing: boolean;
  threshold?: number;
}

/**
 * Visual indicator that hovers above content while user pulls. Render at the
 * top of a page that uses `usePullToRefresh`.
 */
export default function PullToRefreshIndicator({ pull, refreshing, threshold = 70 }: Props) {
  if (pull === 0 && !refreshing) return null;
  const ready = pull >= threshold;
  const opacity = Math.min(1, pull / threshold);
  const translate = refreshing ? 30 : Math.min(40, pull * 0.6);
  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-50 flex justify-center md:hidden"
      style={{ transform: `translateY(${translate}px)`, opacity: refreshing ? 1 : opacity }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-md ring-1 ring-border">
        {refreshing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
          <ArrowDown
            className={cn(
              "h-4 w-4 transition-transform text-muted-foreground",
              ready && "rotate-180 text-primary",
            )}
          />
        )}
      </div>
    </div>
  );
}
