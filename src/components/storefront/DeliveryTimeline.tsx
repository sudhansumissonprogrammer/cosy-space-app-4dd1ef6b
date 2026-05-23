import { ShoppingBag, Truck, PackageCheck, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Cinematic 3-step delivery timeline.
 * One choreographed 2.5s sequence on scroll-in, then quiet ambient state.
 *
 * Timeline:
 *   0.00s  Card rises + fades in
 *   0.15s  Order icon pops (spring overshoot)
 *   0.45s  Truck departs order → shipping; line 1 fills primary in sync
 *   0.95s  Shipping icon pops as truck "delivers" it
 *   1.20s  Truck departs shipping → delivery; line 2 fills
 *   1.85s  Delivery icon bursts, 6-particle confetti, check stamp lands
 *   2.30s  Truck fades out (story over)
 *   loop   Only the delivery circle "breathes" + tiny live dot pulses next to date
 *
 * Respects prefers-reduced-motion (renders static state).
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
  const delivLabel = `${delivMonth} ${fmt(delivStart).raw.getDate()} - ${fmt(delivEnd).raw.getDate()}`;

  const steps = [
    { icon: ShoppingBag,  date: orderLabel, label: "Order Today" },
    { icon: Truck,        date: shipLabel,  label: "Shipping" },
    { icon: PackageCheck, date: delivLabel, label: "Delivery" },
  ];

  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) { setVisible(true); io.disconnect(); break; }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="dt mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5 overflow-hidden"
      data-play={visible ? "1" : "0"}
    >
      <style>{`
        /* ── Keyframes ─────────────────────────────────────────────── */
        @keyframes dt-card-in { 0%{opacity:0;transform:translateY(12px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes dt-pop     { 0%{opacity:0;transform:scale(.4)} 60%{transform:scale(1.18)} 100%{opacity:1;transform:scale(1)} }
        @keyframes dt-rise    { 0%{opacity:0;transform:translateY(6px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes dt-line    { 0%{opacity:0;transform:scaleX(0)} 1%{opacity:1} 100%{opacity:1;transform:scaleX(1)} }
        @keyframes dt-fill-1  { 0%{transform:scaleX(0)} 100%{transform:scaleX(1)} }
        @keyframes dt-fill-2  { 0%{transform:scaleX(0)} 100%{transform:scaleX(1)} }
        @keyframes dt-truck-loop { 0%{opacity:0;left:16.66%} 6%{opacity:1} 94%{opacity:1;left:83.33%} 100%{opacity:0;left:83.33%} }
        @keyframes dt-bounce  { 0%,100%{margin-top:0} 50%{margin-top:-2px} }
        @keyframes dt-stamp   { 0%{opacity:0;transform:scale(0) rotate(-30deg)} 70%{transform:scale(1.3) rotate(0)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes dt-particle{ 0%{opacity:0;transform:translate(-50%,-50%) scale(0)} 20%{opacity:1} 100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1)} }
        @keyframes dt-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.045)} }
        @keyframes dt-live    { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:.5} }
        @keyframes dt-glow    { 0%,100%{box-shadow:0 0 0 0 hsl(var(--primary)/0)} 50%{box-shadow:0 0 14px 1px hsl(var(--primary)/.35)} }

        /* ── Spring curves ─────────────────────────────────────────── */
        .dt { --spring:cubic-bezier(.34,1.56,.64,1); --expo:cubic-bezier(.22,1,.36,1); }

        /* ── Initial hidden state ──────────────────────────────────── */
        .dt .dt-icon, .dt .dt-date, .dt .dt-label, .dt .dt-line,
        .dt .dt-fill, .dt .dt-truck-wrap, .dt .dt-stamp, .dt .dt-particle, .dt .dt-live { opacity:0; }
        .dt[data-play="0"] { opacity:0; transform:translateY(12px); }

        /* ── Play sequence ─────────────────────────────────────────── */
        .dt[data-play="1"] { animation: dt-card-in .55s var(--expo) forwards; }

        .dt[data-play="1"] .dt-icon       { animation: dt-pop .55s var(--spring) forwards; }
        .dt[data-play="1"] .dt-step-0 .dt-icon { animation-delay:.15s; }
        .dt[data-play="1"] .dt-step-1 .dt-icon { animation-delay:.95s; }
        .dt[data-play="1"] .dt-step-2 .dt-icon { animation-delay:1.85s; }

        .dt[data-play="1"] .dt-line { animation: dt-line .35s var(--expo) forwards; transform-origin:left center; }
        .dt[data-play="1"] .dt-line-1 { animation-delay:.35s; }
        .dt[data-play="1"] .dt-line-2 { animation-delay:1.10s; }

        /* Progress fill — gray dashed turns primary as truck passes */
        .dt[data-play="1"] .dt-fill { opacity:1; transform-origin:left center; }
        .dt[data-play="1"] .dt-fill-1 { animation: dt-fill-1 .55s linear .45s forwards; }
        .dt[data-play="1"] .dt-fill-2 { animation: dt-fill-2 .70s linear 1.20s forwards; }

        /* Truck: two-leg journey then fades out */
        .dt[data-play="1"] .dt-truck-wrap {
          animation:
            dt-truck-1 .55s linear .45s forwards,
            dt-truck-2 .70s linear 1.20s forwards,
            dt-truck-out .35s var(--expo) 1.95s forwards;
        }
        .dt[data-play="1"] .dt-truck { animation: dt-bounce .35s ease-in-out infinite; }

        /* Dates + labels rise after their step's icon lands */
        .dt[data-play="1"] .dt-date,
        .dt[data-play="1"] .dt-label { animation: dt-rise .4s var(--expo) forwards; }
        .dt[data-play="1"] .dt-step-0 .dt-date  { animation-delay:.25s; }
        .dt[data-play="1"] .dt-step-1 .dt-date  { animation-delay:1.05s; }
        .dt[data-play="1"] .dt-step-2 .dt-date  { animation-delay:1.95s; }
        .dt[data-play="1"] .dt-step-0 .dt-label { animation-delay:.32s; }
        .dt[data-play="1"] .dt-step-1 .dt-label { animation-delay:1.12s; }
        .dt[data-play="1"] .dt-step-2 .dt-label { animation-delay:2.02s; }

        /* Delivery hero: stamp + particles + ambient breathe + live dot */
        .dt[data-play="1"] .dt-stamp { animation: dt-stamp .45s var(--spring) 2.05s forwards; }
        .dt[data-play="1"] .dt-particle { animation: dt-particle .7s var(--expo) 1.85s forwards; }
        .dt[data-play="1"] .dt-delivery-circle { animation: dt-breathe 3.2s ease-in-out 2.6s infinite, dt-glow 3.2s ease-in-out 2.6s infinite; }
        .dt[data-play="1"] .dt-live { animation: dt-rise .3s var(--expo) 2.3s forwards, dt-live 1.8s ease-in-out 2.6s infinite; }

        @media (prefers-reduced-motion: reduce) {
          .dt, .dt * { animation: none !important; opacity: 1 !important; transform: none !important; }
          .dt .dt-truck-wrap, .dt .dt-particle, .dt .dt-fill { display: none !important; }
        }
      `}</style>

      <div className="relative flex items-start justify-between">
        {/* ── Dashed base lines (gray) ── */}
        <div aria-hidden="true" className="dt-line dt-line-1 pointer-events-none absolute top-6 h-px"
             style={{ left: "16.66%", right: "50%",
                      backgroundImage: "linear-gradient(to right, hsl(var(--border)) 50%, transparent 0%)",
                      backgroundSize: "8px 1px", backgroundRepeat: "repeat-x" }}>
          <div className="dt-fill dt-fill-1 absolute inset-0" style={{ background: "hsl(var(--primary))" }} />
        </div>

        <div aria-hidden="true" className="dt-line dt-line-2 pointer-events-none absolute top-6 h-px"
             style={{ left: "50%", right: "16.66%",
                      backgroundImage: "linear-gradient(to right, hsl(var(--border)) 50%, transparent 0%)",
                      backgroundSize: "8px 1px", backgroundRepeat: "repeat-x" }}>
          <div className="dt-fill dt-fill-2 absolute inset-0" style={{ background: "hsl(var(--primary))" }} />
        </div>

        {/* ── Truck (single journey, no infinite loop) ── */}
        <div aria-hidden="true" className="dt-truck-wrap pointer-events-none absolute top-6 z-20"
             style={{ transform: "translate(-50%, -50%)" }}>
          <div className="dt-truck flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-card">
            <Truck className="h-3.5 w-3.5" strokeWidth={2.25} />
          </div>
        </div>

        {/* ── Steps ── */}
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className={`dt-step-${i} relative z-10 flex flex-1 flex-col items-center gap-2 text-center`}>
              <div className="dt-icon relative">
                <div className={`dt-delivery-circle relative flex h-12 w-12 items-center justify-center rounded-full border-2 bg-card ${
                  isLast ? "border-primary" : "border-foreground/70"
                }`}>
                  <Icon className={`h-5 w-5 ${isLast ? "text-primary" : "text-foreground"}`} strokeWidth={1.75} />

                  {isLast && (
                    <>
                      {/* Confetti burst */}
                      {[
                        { dx: "-22px", dy: "-18px", color: "hsl(var(--primary))" },
                        { dx: "22px",  dy: "-18px", color: "#22c55e" },
                        { dx: "-26px", dy: "4px",   color: "#f59e0b" },
                        { dx: "26px",  dy: "4px",   color: "hsl(var(--primary))" },
                        { dx: "-14px", dy: "-26px", color: "#22c55e" },
                        { dx: "14px",  dy: "-26px", color: "#f59e0b" },
                      ].map((p, k) => (
                        <span key={k} aria-hidden="true" className="dt-particle absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                              style={{ background: p.color, ["--dx" as any]: p.dx, ["--dy" as any]: p.dy } as React.CSSProperties} />
                      ))}
                      {/* Green check stamp */}
                      <span aria-hidden="true"
                            className="dt-stamp absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white shadow ring-2 ring-card">
                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="dt-date text-[13px] font-semibold text-foreground leading-tight inline-flex items-center gap-1 justify-center">
                {s.date}
                {isLast && (
                  <span aria-hidden="true" className="dt-live inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                )}
              </div>
              <div className={`dt-label text-[11px] leading-tight ${isLast ? "text-primary" : "text-muted-foreground"}`}>
                {s.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
