import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared skeleton for V1/V14/V15 themes — shows a branded loading state
 * with a header bar and product grid placeholder.
 */
export default function ClassicStorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <nav className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Skeleton className="h-10 w-10 rounded-lg" /><div className="flex-1" /><Skeleton className="h-10 w-24 rounded-lg absolute left-1/2 -translate-x-1/2" /><div className="flex-1" />
          <Skeleton className="h-9 w-9 rounded-full" /><Skeleton className="h-9 w-9 rounded-full" />
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Skeleton className="mb-5 h-7 w-40" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <Skeleton className="w-full" style={{ aspectRatio: "4/5" }} />
              <div className="px-2.5 pb-2.5 pt-2 space-y-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-20" /><Skeleton className="h-9 w-full rounded-lg" /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
