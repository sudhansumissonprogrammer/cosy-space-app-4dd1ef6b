/** Static placeholder skeleton for product cards — shared across V1/V14/V15 home pages */
export default function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/50 bg-card" style={{ contain: "layout" }}>
      <div className="p-1 pb-0">
        <div className="w-full rounded-lg bg-muted/60" style={{ aspectRatio: "4/5" }} />
      </div>
      <div className="px-3 pt-2.5 pb-3 sm:px-3.5 sm:pb-3.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-16 rounded bg-muted/60" />
          <div className="h-2.5 w-10 rounded bg-muted/60" />
        </div>
        <div className="h-3 w-full rounded bg-muted/60" />
        <div className="h-3 w-3/4 rounded bg-muted/60" />
        <div className="h-4 w-20 rounded bg-muted/60" />
        <div className="h-7 w-full rounded-lg bg-muted/60 sm:h-8" />
      </div>
    </div>
  );
}
