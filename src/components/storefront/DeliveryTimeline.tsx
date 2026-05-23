import { ShoppingBag, Truck, PackageCheck, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Animated 3-step delivery timeline: Order Today → Shipping → Delivery.
 *  - Sequential reveal on scroll into view (stagger pop + rise)
 *  - Dashed lines "draw" left→right between icons
 *  - A tiny truck travels continuously along the full line (order → delivery)
 *  - Soft pulsing ring + green check stamp on Delivery
 *  - Light shimmer sweep across the lines
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
    { icon: Truck,       date: shipLabel,  label: "Shipping",    accent: "text-muted-foreground" },
    { icon: PackageCheck,date: `${delivMonth} ${fmt(delivStart).raw.getDate()} - ${fmt(delivEnd).raw.getDate()}`, label: "Delivery", accent: "text-primary" },
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
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="dt-card mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5 overflow-hidden"
      data-visible={visible ? "1" : "0"}
    >
      <style>{`
        @keyframes dt-pop      { 0%{opacity:0;transform:translateY(10px) scale(.75)} 60%{transform:translateY(0) scale(1.12)} 100%{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes dt-rise     { 0%{opacity:0;transform:translateY(8px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes dt-line     { 0%{opacity:0;transform:scaleX(0)} 1%{opacity:1} 100%{opacity:1;transform:scaleX(1)} }
        @keyframes dt-shimmer  { 0%{transform:translateX(-120%)} 100%{transform:translateX(220%)} }
        @keyframes dt-pulse    { 0%{transform:scale(.85);opacity:.7} 80%{transform:scale(1.75);opacity:0} 100%{transform:scale(1.75);opacity:0} }
        @keyframes dt-truck    { 0%{left:16.66%;opacity:0} 5%{opacity:1} 95%{opacity:1} 100%{left:83.33%;opacity:0} }
        @keyframes dt-bounce-y { 0%,100%{transform:translate(-50%,-50%)} 50%{transform:translate(-50%,calc(-50% - 3px))} }
        @keyframes dt-stamp    { 0%{opacity:0;transform:scale(0) rotate(-25deg)} 70%{transform:scale(1.25) rotate(0)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes dt-glow     { 0%,100%{box-shadow:0 0 0 0 hsl(var(--primary)/0)} 50%{box-shadow:0 0 18px 2px hsl(var(--primary)/.35)} }

        .dt-card .dt-icon,.dt-card .dt-date,.dt-card .dt-label,.dt-card .dt-line,.dt-card .dt-stamp { opacity:0; }
        .dt-card .dt-truck-wrap,.dt-card .dt-shimmer,.dt-card .dt-pulse { opacity:0; }

        .dt-card[data-visible="1"] .dt-icon  { animation: dt-pop .6s cubic-bezier(.34,1.56,.64,1) forwards; }
        .dt-card[data-visible="1"] .dt-date  { animation: dt-rise .5s ease-out forwards; }
        .dt-card[data-visible="1"] .dt-label { animation: dt-rise .5s ease-out forwards; }
        .dt-card[data-visible="1"] .dt-line  { animation: dt-line .65s cubic-bezier(.65,0,.35,1) forwards; transform-origin:left center; }

        .dt-card[data-visible="1"] .dt-step-0 .dt-icon { animation-delay:.05s }
        .dt-card[data-visible="1"] .dt-step-1 .dt-icon { animation-delay:.25s }
        .dt-card[data-visible="1"] .dt-step-2 .dt-icon { animation-delay:.45s }
        .dt-card[data-visible="1"] .dt-step-0 .dt-date { animation-delay:.12s }
        .dt-card[data-visible="1"] .dt-step-1 .dt-date { animation-delay:.32s }
        .dt-card[data-visible="1"] .dt-step-2 .dt-date { animation-delay:.52s }
        .dt-card[data-visible="1"] .dt-step-0 .dt-label{ animation-delay:.18s }
        .dt-card[data-visible="1"] .dt-step-1 .dt-label{ animation-delay:.38s }
        .dt-card[data-visible="1"] .dt-step-2 .dt-label{ animation-delay:.58s }
        .dt-card[data-visible="1"] .dt-line-1 { animation-delay:.18s }
        .dt-card[data-visible="1"] .dt-line-2 { animation-delay:.38s }

        .dt-card[data-visible="1"] .dt-truck-wrap { opacity:1; animation: dt-truck 3.4s cubic-bezier(.5,.05,.5,.95) 1s infinite; }
        .dt-card[data-visible="1"] .dt-truck      { animation: dt-bounce-y .5s ease-in-out infinite; }
        .dt-card[data-visible="1"] .dt-shimmer    { opacity:1; animation: dt-shimmer 2.6s ease-in-out 1.2s infinite; }
        .dt-card[data-visible="1"] .dt-pulse      { opacity:1; animation: dt-pulse 2.2s ease-out .9s infinite; }
        .dt-card[data-visible="1"] .dt-stamp      { animation: dt-stamp .5s cubic-bezier(.34,1.56,.64,1) 1.1s forwards; }
        .dt-card[data-visible="1"] .dt-delivery-circle { animation: dt-glow 2.6s ease-in-out 1.2s infinite; }

        @media (prefers-reduced-motion: reduce){
          .dt-card *{ animation:none !important; opacity:1 !important; transform:none !important; }
          .dt-card .dt-truck-wrap,.dt-card .dt-shimmer,.dt-card .dt-pulse{ display:none !important; }
        }
      `}</style>

      <div className="relative flex items-start justify-between">
        {/* Dashed line segment 1: order → shipping */}
        <div
          aria-hidden="true"
          className="dt-line dt-line-1 pointer-events-none absolute top-6 h-px overflow-hidden"
          style={{
            left: "16.66%", right: "50%",
            backgroundImage: "linear-gradient(to right, hsl(var(--border)) 50%, transparent 0%)",
            backgroundSize: "8px 1px", backgroundRepeat: "repeat-x",
          }}
        >
          <div className="dt-shimmer absolute inset-y-0 w-1/2"
               style={{ background: "linear-gradient(to right, transparent, hsl(var(--primary)/.55), transparent)" }} />
        </div>

        {/* Dashed line segment 2: shipping → delivery */}
        <div
          aria-hidden="true"
          className="dt-line dt-line-2 pointer-events-none absolute top-6 h-px overflow-hidden"
          style={{
            left: "50%", right: "16.66%",
            backgroundImage: "linear-gradient(to right, hsl(var(--border)) 50%, transparent 0%)",
            backgroundSize: "8px 1px", backgroundRepeat: "repeat-x",
          }}
        >
          <div className="dt-shimmer absolute inset-y-0 w-1/2"
               style={{ background: "linear-gradient(to right, transparent, hsl(var(--primary)/.55), transparent)" }} />
        </div>

        {/* Traveling truck along the full timeline */}
        <div
          aria-hidden="true"
          className="dt-truck-wrap pointer-events-none absolute top-6"
          style={{ transform: "translate(-50%, -50%)" }}
        >
          <div className="dt-truck flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
               style={{ transform: "translate(-50%, -50%)" }}>
            <Truck className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
        </div>

        {steps.map((s, i) => {
          const Icon = s.icon;
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className={`dt-step-${i} relative z-10 flex flex-1 flex-col items-center gap-2 text-center`}>
              <div className="dt-icon relative">
                {isLast && (
                  <span aria-hidden="true"
                        className="dt-pulse absolute inset-0 rounded-full"
                        style={{ boxShadow: "0 0 0 2px hsl(var(--primary)/.55)" }} />
                )}
                <div className={`dt-delivery-circle relative flex h-12 w-12 items-center justify-center rounded-full border-2 bg-card ${
                  isLast ? "border-primary" : "border-foreground/70"
                }`}>
                  <Icon className={`h-5 w-5 ${isLast ? "text-primary" : "text-foreground"}`} strokeWidth={1.75} />
                  {isLast && (
                    <span aria-hidden="true"
                          className="dt-stamp absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white shadow"
                          style={{ transformOrigin: "center" }}>
                      <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                    </span>
                  )}
                </div>
              </div>
              <div className="dt-date text-[13px] font-semibold text-foreground leading-tight">{s.date}</div>
              <div className={`dt-label text-[11px] ${s.accent} leading-tight`}>{s.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
