import { CheckCircle2, Clock, PackageCheck, Truck, Home, RotateCcw, XCircle } from "lucide-react";

const STEPS = [
  { key: "pending",   label: "Placed",     icon: Clock },
  { key: "confirmed", label: "Confirmed",  icon: CheckCircle2 },
  { key: "shipped",   label: "Shipped",    icon: Truck },
  { key: "delivered", label: "Delivered",  icon: Home },
] as const;

// `partially_paid` = advance received → treat as Confirmed in the timeline
// (dashboard still shows the raw "partially_paid" badge for the merchant).
const orderRank: Record<string, number> = { pending: 0, confirmed: 1, partially_paid: 1, shipped: 2, delivered: 3 };

export default function OrderStatusTimeline({ status, createdAt, updatedAt }: { status: string; createdAt: string; updatedAt?: string }) {
  if (status === "rto") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-900 dark:bg-orange-950/30">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/50">
          <RotateCcw className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">Returned to Seller (RTO)</p>
          <p className="text-xs text-orange-600/80 dark:text-orange-400/80">
            {updatedAt ? new Date(updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
          </p>
        </div>
      </div>
    );
  }
  if (status === "cancelled") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/30">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-700 dark:text-red-300">Order Cancelled</p>
          <p className="text-xs text-red-600/80 dark:text-red-400/80">
            {updatedAt ? new Date(updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = orderRank[status] ?? 0;

  return (
    <div className="relative">
      <div className="flex items-start justify-between gap-1">
        {STEPS.map((step, i) => {
          const done = i < currentIdx;
          const current = i === currentIdx;
          const Icon = step.icon;
          return (
            <div key={step.key} className="relative flex flex-1 flex-col items-center">
              {/* connector */}
              {i > 0 && (
                <div
                  className="absolute top-5 right-1/2 h-0.5 w-full -z-0"
                  style={{
                    background: i <= currentIdx
                      ? "var(--storefront-primary, hsl(var(--primary)))"
                      : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 12%, transparent)",
                  }}
                />
              )}
              <div
                className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 transition-[transform,opacity,colors,box-shadow] ${
                  current ? "scale-110 shadow-lg" : ""
                }`}
                style={{
                  background: done || current
                    ? "var(--storefront-primary, hsl(var(--primary)))"
                    : "var(--storefront-bg, hsl(var(--background)))",
                  borderColor: done || current
                    ? "var(--storefront-primary, hsl(var(--primary)))"
                    : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 20%, transparent)",
                  color: done || current
                    ? "var(--storefront-primary-foreground, hsl(var(--primary-foreground)))"
                    : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)",
                }}
              >
                <Icon className="h-4 w-4" />
                {current && (
                  <span className="absolute inset-0 rounded-full animate-ping opacity-30"
                        style={{ background: "var(--storefront-primary, hsl(var(--primary)))" }} />
                )}
              </div>
              <p className={`mt-2 text-[11px] text-center font-medium ${current ? "font-semibold" : ""}`}
                 style={{ color: done || current
                   ? "var(--storefront-text, hsl(var(--foreground)))"
                   : "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}>
                {step.label}
              </p>
              {current && updatedAt && (
                <p className="text-[10px]" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
                  {new Date(updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              )}
              {i === 0 && currentIdx === 0 && (
                <p className="text-[10px]" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
                  {new Date(createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { PackageCheck };
