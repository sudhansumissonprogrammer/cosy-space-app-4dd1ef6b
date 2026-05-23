import { ShoppingBag, Truck, PackageCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Three-step delivery timeline: Order Today → Shipping → Delivery.
 * Dates are heuristic (today / +1 / +4–5). Animations:
 *  - Sequential reveal on scroll into view (stagger fade + scale)
 *  - Dashed line "draws" left → right after icons appear
 *  - Ambient shimmer sweep across the line every ~3s
 *  - Soft pulsing ring on the final Delivery icon
 *  - Respects prefers-reduced-motion
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
  const delivMonth = fmt(delivStart).raw.toLocaleString("en-IN", { month: "short" });

  const steps = [
    { icon: ShoppingBag, date: orderLabel, label: "Order Today", accent: "text-foreground" },
    { icon: Truck, date: shipLabel, label: "Shipping", accent: "text-muted-foreground" },
    { icon: PackageCheck, date: `${delivMonth} ${fmt(delivStart).raw.getDate()} - ${fmt(delivEnd).raw.getDate()}`, label: "Delivery", accent: "text-primary" },
  ];

  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { setVisible(true); io.disconnect(); break; }
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="dt-card mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5"
      data-visible={visible ? "1" : "0"}
    >
      <style>{`
        @keyframes dt-pop { 0% { opacity: 0; transform: translateY(8px) scale(.85); } 60% { transform: translateY(0) scale(1.05); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes dt-rise { 0% { opacity: 0; transform: translateY(6px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes dt-line { 0% { transform: scaleX(0); } 100% { transform: scaleX(1); } }
        @keyframes dt-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes dt-pulse-ring { 0% { transform: scale(.9); opacity: .55; } 80% { transform: scale(1.6); opacity: 0; } 100% { transform: scale(1.6); opacity: 0; } }

        .dt-card .dt-icon, .dt-card .dt-date, .dt-card .dt-label, .dt-card .dt-line { opacity: 0; }
        .dt-card[data-visible="1"] .dt-icon { animation: dt-pop .55s cubic-bezier(.34,1.56,.64,1) forwards; }
        .dt-card[data-visible="1"] .dt-date { animation: dt-rise .45s ease-out forwards; }
        .dt-card[data-visible="1"] .dt-label { animation: dt-rise .45s ease-out forwards; }
        .dt-card[data-visible="1"] .dt-line { animation: dt-line .6s cubic-bezier(.65,0,.35,1) forwards; transform-origin: left center; }

        .dt-card[data-visible="1"] .dt-step-0 .dt-icon { animation-delay: .05s; }
        .dt-card[data-visible="1"] .dt-step-1 .dt-icon { animation-delay: .22s; }
        .dt-card[data-visible="1"] .dt-step-2 .dt-icon { animation-delay: .39s; }
        .dt-card[data-visible="1"] .dt-step-0 .dt-date { animation-delay: .12s; }
        .dt-card[data-visible="1"] .dt-step-1 .dt-date { animation-delay: .29s; }
        .dt-card[data-visible="1"] .dt-step-2 .dt-date { animation-delay: .46s; }
        .dt-card[data-visible="1"] .dt-step-0 .dt-label { animation-delay: .18s; }
        .dt-card[data-visible="1"] .dt-step-1 .dt-label { animation-delay: .35s; }
        .dt-card[data-visible="1"] .dt-step-2 .dt-label { animation-delay: .52s; }
        .dt-card[data-visible="1"] .dt-line-1 { animation-delay: .18s; }
        .dt-card[data-visible="1"] .dt-line-2 { animation-delay: .35s; }

        .dt-card[data-visible="1"] .dt-shimmer { animation: dt-shimmer 2.8s ease-in-out 1s infinite; }
        .dt-card[data-visible="1"] .dt-pulse { animation: dt-pulse-ring 2.2s ease-out .9s infinite; }

        @media (prefers-reduced-motion: reduce) {
          .dt-card .dt-icon, .dt-card .dt-date, .dt-card .dt-label, .dt-card .dt-line { opacity: 1 !important; animation: none !important; transform: none !important; }
          .dt-card .dt-shimmer, .dt-card .dt-pulse { animation: none !important; display: none !important; }
        }
      `}</style>

      <div className="relative flex items-start justify-between">
        {/* Connecting dashed lines (between icons), with shimmer overlay on segment 2 */}
        <div
          aria-hidden="true"
          className="dt-line dt-line-1 pointer-events-none absolute top-6 h-px"
          style={{
            left: "16.66%",
            right: "50%",
            backgroundImage: "linear-gradient(to right, hsl(var(--border)) 50%, transparent 0%)",
            backgroundSize: "8px 1px",
            backgroundRepeat: "repeat-x",
          }}
        />
        <div
          aria-hidden="true"
          className="dt-line dt-line-2 pointer-events-none absolute top-6 h-px overflow-hidden"
          style={{
            left: "50%",
            right: "16.66%",
            backgroundImage: "linear-gradient(to right, hsl(var(--border)) 50%, transparent 0%)",
            backgroundSize: "8px 1px",
            backgroundRepeat: "repeat-x",
          }}
        >
          <div
            className="dt-shimmer absolute inset-y-0 w-1/2"
            style={{
              background:
                "linear-gradient(to right, transparent, hsl(var(--primary) / 0.55), transparent)",
            }}
          />
        </div>

        {steps.map((s, i) => {
          const Icon = s.icon;
          const isLast = i === steps.length - 1;
          return (
            <div
              key={i}
              className={`dt-step-${i} relative z-10 flex flex-1 flex-col items-center gap-2 text-center`}
            >
              <div className="dt-icon relative">
                {isLast && (
                  <span
                    aria-hidden="true"
                    className="dt-pulse absolute inset-0 rounded-full"
                    style={{ boxShadow: "0 0 0 2px hsl(var(--primary) / 0.45)" }}
                  />
                )}
                <div
                  className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 bg-card ${
                    isLast ? "border-primary" : "border-foreground/70"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${isLast ? "text-primary" : "text-foreground"}`}
                    strokeWidth={1.75}
                  />
                </div>
              </div>
              <div className="dt-date text-[13px] font-semibold text-foreground leading-tight">
                {s.date}
              </div>
              <div className={`dt-label text-[11px] ${s.accent} leading-tight`}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
