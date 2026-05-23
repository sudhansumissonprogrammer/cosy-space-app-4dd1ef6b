/**
 * Order Confetti Overlay — fires a confetti burst on the global
 * `order-placed` window event. Designed to be a "moment" that drives
 * screenshot shares. Respects prefers-reduced-motion via CSS.
 */
import { useEffect, useState } from "react";

const COLORS = [
  "#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF",
  "#FF9F45", "#C780FA", "#F94892", "#43BCCD",
];

interface Piece {
  id: number;
  cx: number;
  cy: number;
  cr: number;
  color: string;
  delay: number;
}

export default function OrderConfettiOverlay() {
  const [bursts, setBursts] = useState<Piece[][]>([]);

  useEffect(() => {
    const handler = () => {
      // Respect reduced motion
      if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

      const pieces: Piece[] = Array.from({ length: 80 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 80 + Math.random() * 0.3;
        const dist = 220 + Math.random() * 260;
        return {
          id: i,
          cx: Math.cos(angle) * dist,
          cy: Math.sin(angle) * dist - 80, // bias upward
          cr: (Math.random() - 0.5) * 1440,
          color: COLORS[i % COLORS.length],
          delay: Math.random() * 80,
        };
      });
      setBursts(b => [...b, pieces]);
      // Auto-cleanup after the animation
      window.setTimeout(() => {
        setBursts(b => b.slice(1));
      }, 2200);
    };
    window.addEventListener("order-placed", handler);
    return () => window.removeEventListener("order-placed", handler);
  }, []);

  if (bursts.length === 0) return null;

  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999 }}>
      {bursts.map((pieces, bi) => (
        <div key={bi}>
          {pieces.map(p => (
            <span
              key={p.id}
              className="confetti-piece"
              style={{
                background: p.color,
                animationDelay: `${p.delay}ms`,
                ["--cx" as any]: `${p.cx}px`,
                ["--cy" as any]: `${p.cy}px`,
                ["--cr" as any]: `${p.cr}deg`,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
