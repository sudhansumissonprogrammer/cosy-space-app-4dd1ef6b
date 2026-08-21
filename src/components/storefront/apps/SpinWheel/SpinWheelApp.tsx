import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { WheelByStyle } from "./wheels";
import LeadForm from "./LeadForm";
import CouponReveal from "./CouponReveal";
import Confetti from "./Confetti";
import { useWheelAudio } from "./useWheelAudio";
import { useSpinAnimation } from "./useSpinAnimation";
import { resolveWinningIndex, type SpinWheelConfig, type WheelSegment, type WheelStyle } from "./types";

interface Props {
  storeId: string;
  storeName: string;
  primaryColor: string;
  accentColor?: string;
  config: Partial<SpinWheelConfig>;
  previewMode?: boolean;
}

type Phase = "hidden" | "wheel" | "lead" | "reveal";

function discountText(seg: WheelSegment) {
  if (seg.type !== "coupon" || !seg.discount_value) return seg.label;
  return seg.discount_type === "flat"
    ? `₹${seg.discount_value} OFF`
    : `${seg.discount_value}% OFF`;
}

function dialogSurfaceFor(style: WheelStyle, primary: string): React.CSSProperties {
  switch (style) {
    case "neon":
      return {
        background:
          "radial-gradient(ellipse at top, #1a0b3a 0%, #05030f 70%), linear-gradient(180deg, #0a0518, #05030f)",
        color: "#fff",
        boxShadow: "0 30px 60px -12px rgba(0,0,0,0.7), inset 0 0 60px #00e5ff22",
        border: "1px solid rgba(0,229,255,0.25)",
      };
    case "gold":
      return {
        background:
          "radial-gradient(ellipse at top, #1a1408 0%, #0b0904 70%), linear-gradient(180deg, #0f0c05, #050403)",
        color: "#f8ecc9",
        boxShadow: "0 30px 60px -12px rgba(0,0,0,0.7), inset 0 0 60px #f6c45322",
        border: "1px solid rgba(246,196,83,0.35)",
      };
    case "candy":
      return {
        background:
          "radial-gradient(ellipse at top, #ffd1e0 0%, #ffe9f3 55%, #fff5fa 100%)",
        color: "#5a2a3a",
        boxShadow: "0 30px 60px -12px rgba(255,133,162,0.35)",
        border: "1px solid rgba(255,133,162,0.35)",
      };
    case "classic":
    default: {
      return {
        background: `linear-gradient(180deg, ${primary} 0%, #0f1428 140%)`,
        color: "#fff",
        boxShadow: "0 30px 60px -12px rgba(0,0,0,0.6)",
      };
    }
  }
}

function spinButtonStyleFor(style: WheelStyle, _primary: string, _accent: string): React.CSSProperties {
  switch (style) {
    case "neon":
      return {
        background: "linear-gradient(180deg, #fff, #d4faff)",
        color: "#04202b",
        boxShadow: "0 0 0 2px #00e5ff, 0 0 24px #00e5ff88, 0 10px 24px -8px #00e5ff88",
      };
    case "gold":
      return {
        background: "linear-gradient(180deg, #fff5c9 0%, #f6c453 55%, #a8791b 100%)",
        color: "#2a1a05",
        boxShadow: "0 10px 24px -8px rgba(246,196,83,0.6), inset 0 1px 0 #fff",
      };
    case "candy":
      return {
        background: "linear-gradient(180deg, #ff85a2 0%, #ff477e 100%)",
        color: "#fff",
        boxShadow: "0 10px 24px -8px rgba(255,71,126,0.6)",
      };
    case "classic":
    default:
      return {
        background: "#ffffff",
        color: "#0f172a",
      };
  }
}

function confettiPaletteFor(style: WheelStyle, primary: string, accent: string): string[] {
  switch (style) {
    case "neon":
      return ["#00e5ff", "#ff2bd6", "#ffe600", "#8aff00", "#a24bff", "#ff5a5f"];
    case "gold":
      return ["#f6c453", "#fff5c9", "#a8791b", "#ffffff", "#e2b23a"];
    case "candy":
      return ["#ff85a2", "#ffbe0b", "#8ac926", "#4cc9f0", "#b388ff"];
    case "classic":
    default:
      return [primary, accent, "#ffffff", "#ffd166", "#06d6a0"];
  }
}


// Never interrupt a shopper who is paying. The old check only matched paths
// that START with /checkout, so `/store/<slug>/checkout` (preview + path-based
// storefronts) slipped through, and because the effect never re-ran on
// client-side navigation the timer that started on the product page fired the
// wheel *on top of* the payment screen — a full-screen overlay blocking UPI.
const BLOCKED_SEGMENT_RX = /(^|\/)(checkout|order|order-success|orders|admin|dashboard|auth|login|signup|account)(\/|$)/i;
export function isBlockedPath(pathname: string): boolean {
  return BLOCKED_SEGMENT_RX.test(pathname || "");
}

export default function SpinWheelApp({ storeId, storeName, primaryColor, accentColor, config, previewMode = false }: Props) {
  const cfg: SpinWheelConfig = {
    trigger_delay_ms: 11000,
    show_on_mobile: true,
    show_on_desktop: true,
    require_otp: true,
    wheel_style: "classic",
    sound_enabled: true,
    time_trigger_enabled: true,
    exit_intent_enabled: true,
    exit_intent_scope: "all",
    outcome_mode: "random",
    fixed_segment_index: 0,

    heading: "Spin to win exclusive coupons",
    subheading: "",
    button_label: "Spin Now",
    lead_heading: "Woah! What a win 🎉",
    lead_subheading: "Enter your mobile to unlock your reward",
    marketing_consent_label: "Notify me for offers & updates on WhatsApp",
    segments: [],
    ...config,
    // OTP is a permanent security requirement for Spin Wheel leads. Keep this
    // after the stored config spread so legacy `require_otp: false` rows cannot
    // bypass verification.
    require_otp: true,
  } as SpinWheelConfig;

  const segments = (cfg.segments || []).filter(Boolean);
  const wheelStyle: WheelStyle = (cfg.wheel_style || "classic") as WheelStyle;
  const [phase, setPhase] = useState<Phase>("hidden");
  const [spinning, setSpinning] = useState(false);
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const [spinDelta, setSpinDelta] = useState(0);
  const [spinDuration, setSpinDuration] = useState(4500);
  const [spinToken, setSpinToken] = useState(0);
  const timerRef = useRef<number | null>(null);
  const visibleAccumRef = useRef(0);
  const lastVisibleAtRef = useRef<number | null>(null);
  const audio = useWheelAudio(cfg.sound_enabled !== false);

  // Track the live route. The storefront is an SPA, so a shopper can move from
  // a product page onto /checkout while the wheel timer is still counting.
  // Keeping this in state lets us both cancel the pending trigger and unmount
  // an already-open wheel the moment they reach a payment screen.
  const [routePath, setRoutePath] = useState(
    () => (typeof window !== "undefined" ? window.location.pathname : ""),
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setRoutePath(window.location.pathname);
    window.addEventListener("popstate", sync);
    // pushState/replaceState don't emit events; a light poll is the only
    // router-agnostic way to notice client-side navigation here.
    const id = window.setInterval(sync, 700);
    return () => {
      window.removeEventListener("popstate", sync);
      window.clearInterval(id);
    };
  }, []);
  const routeBlocked = !previewMode && isBlockedPath(routePath);
  useEffect(() => {
    if (routeBlocked) setPhase("hidden");
  }, [routeBlocked]);


  useEffect(() => {
    if (!storeId || segments.length < 2) return;
    if (routeBlocked) return;
    const p = routePath;

    const leadKey = `sf_spin_lead_${storeId}`;
    const timerKey = `sf_spin_shown_${storeId}`;
    const exitKey = `sf_spin_exit_${storeId}`;
    try {
      if (!previewMode && localStorage.getItem(leadKey)) return;
    } catch {}

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile && !cfg.show_on_mobile) return;
    if (!isMobile && !cfg.show_on_desktop) return;

    const timerEnabled = cfg.time_trigger_enabled !== false;
    const exitEnabled = cfg.exit_intent_enabled !== false;
    const scope = cfg.exit_intent_scope || "all";
    const onProductPage = /^\/(product|products)\//i.test(p);
    const exitScopeMatches = previewMode || scope === "all" || (scope === "product" && onProductPage);

    let timerCleanup: (() => void) | null = null;
    const alreadyTimerShown = (() => { try { return !!sessionStorage.getItem(timerKey); } catch { return false; } })();
    if (timerEnabled && !alreadyTimerShown) {
      const target = Math.max(3000, cfg.trigger_delay_ms || 11000);
      const tick = () => {
        if (document.visibilityState === "visible") {
          const now = performance.now();
          if (lastVisibleAtRef.current == null) lastVisibleAtRef.current = now;
          visibleAccumRef.current += now - (lastVisibleAtRef.current ?? now);
          lastVisibleAtRef.current = now;
        }
        if (visibleAccumRef.current >= target) {
          try { sessionStorage.setItem(timerKey, "1"); } catch {}
          try { if (!previewMode && localStorage.getItem(leadKey)) { if (timerRef.current) window.clearInterval(timerRef.current); return; } } catch {}
          setPhase((cur) => cur === "hidden" ? "wheel" : cur);
          if (timerRef.current) window.clearInterval(timerRef.current);
        }
      };
      const onVis = () => {
        if (document.visibilityState === "visible") lastVisibleAtRef.current = performance.now();
        else lastVisibleAtRef.current = null;
      };
      document.addEventListener("visibilitychange", onVis);
      onVis();
      timerRef.current = window.setInterval(tick, 500);
      timerCleanup = () => {
        if (timerRef.current) window.clearInterval(timerRef.current);
        document.removeEventListener("visibilitychange", onVis);
      };
    }

    let exitCleanup: (() => void) | null = null;
    const alreadyExitShown = (() => { try { return !!sessionStorage.getItem(exitKey); } catch { return false; } })();
    if (exitEnabled && exitScopeMatches && !alreadyExitShown) {
      const fireExit = () => {
        try { if (!previewMode && localStorage.getItem(leadKey)) return; } catch {}
        try { sessionStorage.setItem(exitKey, "1"); } catch {}
        setPhase((cur) => cur === "hidden" ? "wheel" : cur);
        exitCleanup?.();
      };

      if (isMobile) {
        try { history.pushState({ __sfExit: 1 }, ""); } catch {}
        const onPop = () => {
          try { if (!previewMode && localStorage.getItem(leadKey)) return; } catch {}
          fireExit();
        };
        window.addEventListener("popstate", onPop);
        exitCleanup = () => window.removeEventListener("popstate", onPop);
      } else {
        const onLeave = (e: MouseEvent) => {
          if (e.clientY <= 0 && !e.relatedTarget) fireExit();
        };
        document.addEventListener("mouseout", onLeave);
        exitCleanup = () => document.removeEventListener("mouseout", onLeave);
      }
    }

    return () => {
      timerCleanup?.();
      exitCleanup?.();
    };
  }, [
    storeId,
    cfg.trigger_delay_ms,
    cfg.show_on_mobile,
    cfg.show_on_desktop,
    cfg.time_trigger_enabled,
    cfg.exit_intent_enabled,
    cfg.exit_intent_scope,
    segments.length,
    previewMode,
    routeBlocked,
    routePath,
  ]);

  const prefersReduced = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const [resolvedColors, setResolvedColors] = useState({ p: primaryColor, a: accentColor || primaryColor });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const cs = getComputedStyle(document.documentElement);
      const p = cs.getPropertyValue("--storefront-primary").trim() || primaryColor;
      const a = cs.getPropertyValue("--storefront-accent").trim() || accentColor || p;
      setResolvedColors({ p, a });
    } catch {}
  }, [primaryColor, accentColor]);

  const rotation = useSpinAnimation({
    targetDelta: spinDelta,
    duration: spinDuration,
    sliceCount: Math.max(1, segments.length),
    active: spinning && spinToken > 0,
    onTick: () => audio.tick(),
    onDone: () => {
      setSpinning(false);
      const winner = resultIndex != null ? segments[resultIndex] : null;
      if (winner?.type === "coupon" && winner?.code) audio.win();
      else audio.lose();
      if (typeof (navigator as any).vibrate === "function") {
        try { (navigator as any).vibrate([15, 40, 15]); } catch {}
      }
      window.setTimeout(() => setPhase("lead"), 350);
    },
  });

  const spin = () => {
    if (spinning || segments.length < 2) return;
    // "fixed" mode: the merchant decided the prize — every shopper lands on the
    // same slice, resolved by code/label first so reordering slices can never
    // hand out a different prize than the dashboard shows.
    const idx = resolveWinningIndex(cfg, segments);


    const sliceAngle = 360 / segments.length;
    const targetSlice = (idx + 0.5) * sliceAngle;
    const spins = 6 + Math.floor(Math.random() * 3);
    const jitter = Math.random() * (sliceAngle * 0.3) - sliceAngle * 0.15;
    const delta = spins * 360 - targetSlice + jitter - (rotation % 360);
    setResultIndex(idx);
    setSpinDuration(prefersReduced ? 400 : 4500);
    setSpinDelta(delta);
    setSpinToken((t) => t + 1);
    setSpinning(true);
    if (typeof (navigator as any).vibrate === "function") {
      try { (navigator as any).vibrate([10, 30, 10]); } catch {}
    }
  };

  const close = () => setPhase("hidden");

  if (phase === "hidden") return null;

  const winner = resultIndex != null ? segments[resultIndex] : null;
  const won = winner?.type === "coupon" && !!winner?.code;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-3 sm:p-6"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-[420px] rounded-3xl p-6 pt-10 animate-scale-in overflow-hidden"
        style={dialogSurfaceFor(wheelStyle, resolvedColors.p)}
      >
        {phase === "lead" && won && (
          <Confetti colors={confettiPaletteFor(wheelStyle, resolvedColors.p, resolvedColors.a)} />
        )}
        <button
          onClick={close}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={2.5} />
        </button>

        {phase === "wheel" && (
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/60">{storeName}</p>
            <h2 className="mt-2 text-xl font-extrabold leading-tight">{cfg.heading}</h2>
            {cfg.subheading ? (
              <p className="mt-1 text-xs text-white/60">{cfg.subheading}</p>
            ) : null}

            <div className="mt-6">
              <WheelByStyle
                style={wheelStyle}
                segments={segments}
                rotation={rotation}
                primary={resolvedColors.p}
                accent={resolvedColors.a}
                size={280}
              />
            </div>

            <button
              onClick={spin}
              disabled={spinning}
              className="mt-6 h-12 w-full max-w-[220px] rounded-full text-base font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
              style={spinButtonStyleFor(wheelStyle, resolvedColors.p, resolvedColors.a)}
            >
              {spinning ? "Spinning…" : cfg.button_label}
            </button>
          </div>
        )}

        {phase === "lead" && winner && (
          <div>
            <div className="mx-auto mb-4 max-w-[300px] rounded-2xl bg-[#faf5d7] py-6 text-center text-slate-900 shadow-inner">
              <p className="text-lg font-extrabold">
                {won ? "You Won!" : "Better Luck Next Time"}
              </p>
              {won ? (
                <p className="mt-1 text-sm font-semibold text-slate-700">{discountText(winner)}</p>
              ) : null}
            </div>
            {won ? (
              <LeadForm
                storeId={storeId}
                segmentLabel={winner.label}
                couponCode={winner.code}
                heading={cfg.lead_heading}
                subheading={cfg.lead_subheading}
                consentLabel={cfg.marketing_consent_label}
                previewMode={previewMode}

                onSubmitted={() => setPhase("reveal")}
              />
            ) : (
              <button
                onClick={close}
                className="mt-2 h-12 w-full rounded-xl bg-white/10 font-semibold text-white hover:bg-white/20"
              >
                Continue Shopping
              </button>
            )}
          </div>
        )}

        {phase === "reveal" && winner?.code && (
          <CouponReveal
            code={winner.code}
            label={winner.label}
            discountText={discountText(winner)}
            minOrder={winner.min_order}
            onClose={close}
          />
        )}
      </div>
    </div>
  );
}
