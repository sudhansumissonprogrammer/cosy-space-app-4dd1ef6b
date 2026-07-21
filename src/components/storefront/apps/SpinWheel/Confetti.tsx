import { useMemo } from "react";

interface Props {
  colors?: string[];
  count?: number;
}

export default function Confetti({ colors, count = 90 }: Props) {
  const palette = colors && colors.length ? colors : ["#ff477e", "#ffb347", "#fddb3a", "#3ddc97", "#3aa0ff", "#c86bfa"];

  const pieces = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const c = palette[i % palette.length];
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const dur = 1.6 + Math.random() * 1.6;
      const rot = Math.random() * 360;
      const drift = (Math.random() - 0.5) * 220;
      const size = 6 + Math.random() * 8;
      const shape = Math.random() > 0.5 ? "0" : "50%";
      return { c, left, delay, dur, rot, drift, size, shape, i };
    });
  }, [count, palette.join("|")]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes sw-confetti-fall {
          0%   { transform: translate3d(0,-20px,0) rotate(0deg); opacity: 1; }
          100% { transform: translate3d(var(--dx), 110vh, 0) rotate(var(--r)); opacity: 0.9; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.i}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 1.4,
            background: p.c,
            borderRadius: p.shape,
            // @ts-ignore CSS custom prop
            "--dx": `${p.drift}px`,
            "--r": `${p.rot + 720}deg`,
            animation: `sw-confetti-fall ${p.dur}s cubic-bezier(0.2, 0.7, 0.4, 1) ${p.delay}s forwards`,
            boxShadow: `0 0 8px ${p.c}66`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}
