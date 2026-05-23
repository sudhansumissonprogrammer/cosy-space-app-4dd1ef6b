import { ShoppingBag, Truck, PackageCheck } from "lucide-react";

/**
 * Three-step delivery timeline: Order Today → Shipping → Delivery.
 * Dates are heuristic (today / +1 / +4–5). Designed for product detail page.
 */
function fmt(d: Date) {
  const day = d.getDate();
  const month = d.toLocaleString("en-IN", { month: "short" });
  const suffix =
    day % 10 === 1 && day !== 11 ? "st" :
    day % 10 === 2 && day !== 12 ? "nd" :
    day % 10 === 3 && day !== 13 ? "rd" : "th";
  return { day: `${month} ${day}${suffix}`, raw: d };
}

export default function DeliveryTimeline() {
  const today = new Date();
  const ship = new Date(today); ship.setDate(today.getDate() + 1);
  const delivStart = new Date(today); delivStart.setDate(today.getDate() + 4);
  const delivEnd = new Date(today); delivEnd.setDate(today.getDate() + 5);

  const orderLabel = fmt(today).day;
  const shipLabel = fmt(ship).day;
  const delivLabel = `${fmt(delivStart).day.split(" ").slice(1).join(" ")} - ${fmt(delivEnd).day.split(" ").slice(1).join(" ")}`;
  const delivMonth = fmt(delivStart).raw.toLocaleString("en-IN", { month: "short" });

  const steps = [
    { icon: ShoppingBag, date: orderLabel, label: "Order Today", accent: "text-foreground" },
    { icon: Truck, date: shipLabel, label: "Shipping", accent: "text-muted-foreground" },
    { icon: PackageCheck, date: `${delivMonth} ${fmt(delivStart).raw.getDate()} - ${fmt(delivEnd).raw.getDate()}`, label: "Delivery", accent: "text-primary" },
  ];

  return (
    <div className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="relative flex items-start justify-between">
        {/* connecting dashed line */}
        <div
          className="pointer-events-none absolute left-[16%] right-[16%] top-6 h-px"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--border)) 50%, transparent 0%)",
            backgroundSize: "8px 1px",
            backgroundRepeat: "repeat-x",
          }}
          aria-hidden="true"
        />
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className="relative z-10 flex flex-1 flex-col items-center gap-2 text-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 bg-card ${
                  isLast ? "border-primary" : "border-foreground/70"
                }`}
              >
                <Icon className={`h-5 w-5 ${isLast ? "text-primary" : "text-foreground"}`} strokeWidth={1.75} />
              </div>
              <div className="text-[13px] font-semibold text-foreground leading-tight">{s.date}</div>
              <div className={`text-[11px] ${s.accent} leading-tight`}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
