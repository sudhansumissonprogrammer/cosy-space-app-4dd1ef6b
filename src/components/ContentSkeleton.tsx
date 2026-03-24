import { Skeleton } from "@/components/ui/skeleton";

/** Minimal content-area placeholder for layout Suspense boundaries.
 *  Intentionally simple (no shimmer) — lazy chunks load near-instantly
 *  thanks to prefetching, so this is only visible for a split-second. */
export function ContentSkeleton() {
  return (
    <div className="min-h-[200px]" />
  );
}

/** Minimal storefront content skeleton */
export function StorefrontContentSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6">
      <Skeleton className="h-7 w-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl">
            <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
