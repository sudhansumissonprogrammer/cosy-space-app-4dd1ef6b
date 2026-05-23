import { ShoppingBag, Truck, PackageCheck, Check, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Premium 3-step delivery timeline.
 * Glass card · gradient progress rail · double-ring nodes · looping truck pill.
 * Uses semantic tokens (primary, foreground, muted, card, border) so it adapts to every theme.
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
  const delivLabel = `${delivMonth} ${fmt(delivStart).raw.getDate()}–${fmt(delivEnd).raw.getDate()}`;

  const steps = [
    { icon: ShoppingBag,  date: orderLabel, label: "Order Today",   sub: "Confirmed" },
    { icon: Truck,        date: shipLabel,  label: "Shipping",      sub: "Dispatched" },
    { icon: PackageCheck, date: delivLabel, label: "Delivery",      sub: "Est. Arrival" },
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
      className="dt relative mt-5 rounded-2xl border border-border/70 bg-card p-4 pt-5 sm:p-5 overflow-hidden shadow-sm"
      data-play={visible ? "1" : "0"}
      style={{
        backgroundImage:
          "radial-gradient(120% 80% at 0% 0%, hsl(var(--primary)/0.06), transparent 55%), radial-gradient(120% 80% at 100% 100%, hsl(var(--primary)/0.05), transparent 55%)",
      }}
    >
      <style>{`
        @keyframes dt-card-in { 0%{opacity:0;transform:translateY(10px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes dt-pop     { 0%{opacity:0;transform:scale(.55)} 60%{transform:scale(1.14)} 100%{opacity:1;transform:scale(1)} }
        @keyframes dt-rise    { 0%{opacity:0;transform:translateY(6px)} 100%{opacity:1;transform:translateY(0)} }
        @keyframes dt-rail    { 0%{transform:scaleX(0)} 100%{transform:scaleX(1)} }
        @keyframes dt-truck-loop { 0%{opacity:0;left:16.66%} 6%{opacity:1} 94%{opacity:1;left:83.33%} 100%{opacity:0;left:83.33%} }
        @keyframes dt-bob     { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-2px)} }
        @keyframes dt-stamp   { 0%{opacity:0;transform:scale(0) rotate(-25deg)} 70%{transform:scale(1.25) rotate(0)} 100%{opacity:1;transform:scale(1) rotate(0)} }
        @keyframes dt-particle{ 0%{opacity:0;transform:translate(-50%,-50%) scale(0)} 25%{opacity:1} 100%{opacity:0;transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1)} }
        @keyframes dt-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
        @keyframes dt-halo    { 0%,100%{opacity:.35;transform:scale(1)} 50%{opacity:.7;transform:scale(1.15)} }
        @keyframes dt-live    { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:.45} }
        @keyframes dt-shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        .dt { --spring:cubic-bezier(.34,1.56,.64,1); --expo:cubic-bezier(.22,1,.36,1); }

        .dt .dt-node, .dt .dt-date, .dt .dt-label, .dt .dt-sub, .dt .dt-rail-fill,
        .dt .dt-truck-wrap, .dt .dt-stamp, .dt .dt-particle, .dt .dt-live, .dt .dt-halo { opacity:0; }
        .dt[data-play="0"] { opacity:0; transform:translateY(10px); }
        .dt[data-play="1"] { animation: dt-card-in .6s var(--expo) forwards; }

        .dt[data-play="1"] .dt-node { animation: dt-pop .55s var(--spring) forwards; }
        .dt[data-play="1"] .dt-step-0 .dt-node { animation-delay:.15s; }
        .dt[data-play="1"] .dt-step-1 .dt-node { animation-delay:.95s; }
        .dt[data-play="1"] .dt-step-2 .dt-node { animation-delay:1.75s; }

        .dt[data-play="1"] .dt-rail-fill { opacity:1; transform-origin:left center; }
        .dt[data-play="1"] .dt-rail-fill-1 { animation: dt-rail .55s linear .45s forwards; }
        .dt[data-play="1"] .dt-rail-fill-2 { animation: dt-rail .70s linear 1.10s forwards; }

        /* Truck: continuous loop across the whole rail */
        .dt[data-play="1"] .dt-truck-wrap { animation: dt-truck-loop 3.6s linear .4s infinite; }
        .dt[data-play="1"] .dt-truck { animation: dt-bob .6s ease-in-out infinite; }

        .dt[data-play="1"] .dt-date,
        .dt[data-play="1"] .dt-label,
        .dt[data-play="1"] .dt-sub { animation: dt-rise .4s var(--expo) forwards; }
        .dt[data-play="1"] .dt-step-0 .dt-date  { animation-delay:.28s; }
        .dt[data-play="1"] .dt-step-1 .dt-date  { animation-delay:1.05s; }
        .dt[data-play="1"] .dt-step-2 .dt-date  { animation-delay:1.85s; }
        .dt[data-play="1"] .dt-step-0 .dt-label,
        .dt[data-play="1"] .dt-step-0 .dt-sub   { animation-delay:.34s; }
        .dt[data-play="1"] .dt-step-1 .dt-label,
        .dt[data-play="1"] .dt-step-1 .dt-sub   { animation-delay:1.12s; }
        .dt[data-play="1"] .dt-step-2 .dt-label,
        .dt[data-play="1"] .dt-step-2 .dt-sub   { animation-delay:1.92s; }

        .dt[data-play="1"] .dt-stamp { animation: dt-stamp .45s var(--spring) 1.95s forwards; }
        .dt[data-play="1"] .dt-particle { animation: dt-particle .8s var(--expo) 1.78s forwards; }
        .dt[data-play="1"] .dt-step-2 .dt-node-inner { animation: dt-breathe 3.2s ease-in-out 2.6s infinite; }
        .dt[data-play="1"] .dt-step-2 .dt-halo { animation: dt-rise .3s var(--expo) 2.0s forwards, dt-halo 2.6s ease-in-out 2.4s infinite; }
        .dt[data-play="1"] .dt-live { animation: dt-rise .3s var(--expo) 2.1s forwards, dt-live 1.8s ease-in-out 2.5s infinite; }

        .dt-shimmer { background: linear-gradient(90deg, transparent 0%, hsl(var(--primary-foreground)/0.4) 50%, transparent 100%); background-size:200% 100%; animation: dt-shimmer 2.2s linear infinite; }

        @media (prefers-reduced-motion: reduce) {
          .dt, .dt * { animation: none !important; opacity: 1 !important; transform: none !important; }
          .dt .dt-truck-wrap, .dt .dt-particle, .dt .dt-rail-fill { display: none !important; }
        }
      `}</style>

      {/* Ornamental corner sparkle */}
      <Sparkles aria-hidden className="absolute right-3 top-3 h-3.5 w-3.5 text-primary/40" strokeWidth={1.5} />

      <div className="relative flex items-start justify-between pt-1">
        {/* ── Rail base (rounded gradient track) ── */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-[26px] h-[3px] rounded-full"
          style={{
            left: "16.66%",
            right: "16.66%",
            background:
              "linear-gradient(90deg, hsl(var(--muted)) 0%, hsl(var(--border)) 50%, hsl(var(--muted)) 100%)",
          }}
        />

        {/* Rail fill segment 1 (left → middle) */}
        <div
          aria-hidden="true"
          className="dt-rail-fill dt-rail-fill-1 pointer-events-none absolute top-[26px] h-[3px] rounded-full overflow-hidden"
          style={{
            left: "16.66%",
            right: "50%",
            background: "linear-gradient(90deg, hsl(var(--primary)/0.85), hsl(var(--primary)))",
            transformOrigin: "left center",
            boxShadow: "0 0 10px hsl(var(--primary)/0.35)",
          }}
        >
          <div className="dt-shimmer absolute inset-0" />
        </div>

        {/* Rail fill segment 2 (middle → right) */}
        <div
          aria-hidden="true"
          className="dt-rail-fill dt-rail-fill-2 pointer-events-none absolute top-[26px] h-[3px] rounded-full overflow-hidden"
          style={{
            left: "50%",
            right: "16.66%",
            background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/0.85))",
            transformOrigin: "left center",
            boxShadow: "0 0 10px hsl(var(--primary)/0.35)",
          }}
        >
          <div className="dt-shimmer absolute inset-0" />
        </div>

        {/* ── Looping truck pill ── */}
        <div
          aria-hidden="true"
          className="dt-truck-wrap pointer-events-none absolute top-[26px] z-20"
          style={{ transform: "translate(-50%, -50%)" }}
        >
          <div className="dt-truck flex items-center gap-1 rounded-full bg-primary px-2 py-1 shadow-[0_6px_14px_hsl(var(--primary)/0.45)] ring-2 ring-card">
            <Truck className="h-3 w-3 text-primary-foreground" strokeWidth={2.5} />
            <span className="h-1 w-1 rounded-full bg-primary-foreground/80" />
          </div>
        </div>

        {/* ── Steps ── */}
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isLast = i === steps.length - 1;
          return (
            <div key={i} className={`dt-step-${i} relative z-10 flex flex-1 flex-col items-center gap-2 text-center`}>
              <div className="dt-node relative">
                {/* halo (delivery only, ambient) */}
                {isLast && (
                  <span aria-hidden className="dt-halo absolute inset-0 -m-1 rounded-full"
                    style={{ background: "radial-gradient(circle, hsl(var(--primary)/0.35) 0%, transparent 70%)" }} />
                )}
                <div
                  className={`dt-node-inner relative flex h-[52px] w-[52px] items-center justify-center rounded-full border-[2.5px] bg-card ${
                    isLast ? "border-primary" : "border-foreground/25"
                  }`}
                  style={
                    isLast
                      ? { backgroundImage: "linear-gradient(135deg, hsl(var(--primary)/0.12), hsl(var(--card)) 60%)", boxShadow: "0 4px 14px hsl(var(--primary)/0.18)" }
                      : { backgroundImage: "linear-gradient(135deg, hsl(var(--muted)/0.5), hsl(var(--card)))" }
                  }
                >
                  <Icon className={`h-5 w-5 ${isLast ? "text-primary" : "text-foreground/80"}`} strokeWidth={1.9} />

                  {isLast && (
                    <>
                      {/* confetti burst */}
                      {[
                        { dx: "-24px", dy: "-20px", color: "hsl(var(--primary))" },
                        { dx: "24px",  dy: "-20px", color: "#22c55e" },
                        { dx: "-28px", dy: "4px",   color: "#f59e0b" },
                        { dx: "28px",  dy: "4px",   color: "hsl(var(--primary))" },
                        { dx: "-14px", dy: "-28px", color: "#22c55e" },
                        { dx: "14px",  dy: "-28px", color: "#f59e0b" },
                      ].map((p, k) => (
                        <span key={k} aria-hidden="true" className="dt-particle absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                              style={{ background: p.color, ["--dx" as any]: p.dx, ["--dy" as any]: p.dy } as React.CSSProperties} />
                      ))}
                      {/* green check stamp */}
                      <span aria-hidden="true"
                            className="dt-stamp absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white shadow ring-2 ring-card">
                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div
                className="dt-date text-[13px] font-semibold leading-tight text-foreground inline-flex items-center gap-1 justify-center"
                style={{ fontFamily: "var(--storefront-heading-font, inherit)", letterSpacing: "0.01em" }}
              >
                {s.date}
                {isLast && (
                  <span aria-hidden="true" className="dt-live ml-0.5 inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                )}
              </div>
              <div className={`dt-label text-[10px] font-semibold uppercase tracking-[0.14em] leading-tight ${isLast ? "text-primary" : "text-muted-foreground"}`}>
                {s.label}
              </div>
              <div className="dt-sub text-[9.5px] text-muted-foreground/80 leading-tight -mt-1">
                {s.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer pill */}
      <div className="mt-4 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Free Shipping · Cash on Delivery
          </span>
        </div>
      </div>
    </div>
  );
}
