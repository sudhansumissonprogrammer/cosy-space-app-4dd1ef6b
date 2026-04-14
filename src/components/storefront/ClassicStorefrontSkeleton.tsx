/**
 * Pure-CSS skeleton for V1/V14/V15 themes — zero JS imports,
 * keeps the animate-pulse/Skeleton component off the critical path.
 */
export default function ClassicStorefrontSkeleton() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <nav className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-6">
          <div className="h-10 w-10 rounded-lg bg-muted/60 animate-pulse" />
          <div className="flex-1" />
          <div className="h-10 w-24 rounded-lg bg-muted/60 animate-pulse absolute left-1/2 -translate-x-1/2" />
          <div className="flex-1" />
          <div className="h-9 w-9 rounded-full bg-muted/60 animate-pulse" />
          <div className="h-9 w-9 rounded-full bg-muted/60 animate-pulse" />
        </div>
      </nav>
      <div className="mx-auto max-w-7xl px-4 lg:px-6 py-6">
        <div className="mb-5 h-7 w-40 rounded bg-muted/60 animate-pulse" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {[0,1,2,3,4,5,6,7].map(i => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="w-full bg-muted/60 animate-pulse" style={{ aspectRatio: "4/5" }} />
              <div className="px-2.5 pb-2.5 pt-2 space-y-2">
                <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
                <div className="h-4 w-full rounded bg-muted/60 animate-pulse" />
                <div className="h-4 w-20 rounded bg-muted/60 animate-pulse" />
                <div className="h-9 w-full rounded-lg bg-muted/60 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}