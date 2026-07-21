import { useMemo } from "react";
import type { WheelSegment, WheelStyle } from "./types";

export interface WheelProps {
  segments: WheelSegment[];
  rotation: number;
  primary: string;
  accent: string;
  size?: number;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
};
const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
const rgbToHex = (r: number, g: number, b: number) => `#${toHex(r)}${toHex(g)}${toHex(b)}`;
const mix = (a: string, b: string, t: number) => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
};
const isLight = (hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
};
const readable = (bg: string) => (isLight(bg) ? "#1a1a1a" : "#ffffff");

function paletteFor(style: WheelStyle, primary: string, accent: string, n: number): string[] {
  const p = primary || "#3b3ab5";
  const a = accent && accent !== primary ? accent : mix(p, "#ffffff", 0.55);
  switch (style) {
    case "neon":
      return Array.from({ length: n }, (_, i) => {
        const hues = ["#0a0e27", "#ff2bd6", "#111633", "#00e5ff"];
        return hues[i % hues.length];
      });
    case "gold":
      return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? "#0d0d10" : "#f6c453"));
    case "candy":
      return Array.from({ length: n }, (_, i) => {
        const pastels = ["#ffb3c6", "#a5dcff", "#ffe27a", "#b8ecac", "#d4b3ff", "#ffc48a"];
        return pastels[i % pastels.length];
      });
    case "classic":
    default: {
      return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? p : a));
    }
  }
}

interface BaseProps extends WheelProps {
  style: WheelStyle;
  renderHub: () => React.ReactNode;
  renderBezel: () => React.ReactNode;
  renderPointer: () => React.ReactNode;
  containerStyle?: React.CSSProperties;
}

function WheelBase({
  segments,
  rotation,
  primary,
  accent,
  size = 300,
  style,
  renderHub,
  renderBezel,
  renderPointer,
  containerStyle,
}: BaseProps) {
  const n = segments.length;
  const sliceAngle = 360 / n;
  const cx = 200;
  const cy = 200;
  const r = 190;

  const palette = useMemo(() => paletteFor(style, primary, accent, n), [style, primary, accent, n]);

  const paths = useMemo(() => {
    return segments.map((seg, i) => {
      const startAngle = i * sliceAngle - 90;
      const endAngle = (i + 1) * sliceAngle - 90;
      const s = (startAngle * Math.PI) / 180;
      const e = (endAngle * Math.PI) / 180;
      const x1 = cx + r * Math.cos(s);
      const y1 = cy + r * Math.sin(s);
      const x2 = cx + r * Math.cos(e);
      const y2 = cy + r * Math.sin(e);
      const large = sliceAngle > 180 ? 1 : 0;
      const d = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`;
      const fill = seg.color || palette[i];
      const midAngle = startAngle + sliceAngle / 2;
      const tr = r * 0.62;
      const tx = cx + tr * Math.cos((midAngle * Math.PI) / 180);
      const ty = cy + tr * Math.sin((midAngle * Math.PI) / 180);
      return { d, fill, tx, ty, midAngle, label: seg.label, textColor: readable(fill) };
    });
  }, [segments, sliceAngle, palette]);

  return (
    <div className="relative mx-auto" style={{ width: size, height: size, ...containerStyle }}>
      {renderBezel()}
      <svg
        viewBox="0 0 400 400"
        width={size}
        height={size}
        className="relative block"
        style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.45))" }}
      >
        <g
          style={{
            transformOrigin: "200px 200px",
            transform: `rotate(${rotation}deg)`,
            willChange: "transform",
          }}
        >
          {paths.map((p, i) => (
            <g key={i}>
              <path d={p.d} fill={p.fill} stroke="rgba(0,0,0,0.15)" strokeWidth={1} />
              <text
                x={p.tx}
                y={p.ty}
                fill={p.textColor}
                fontSize={n <= 4 ? 20 : n <= 6 ? 16 : 13}
                fontWeight={800}
                textAnchor="middle"
                dominantBaseline="middle"
                transform={`rotate(${p.midAngle + 90}, ${p.tx}, ${p.ty})`}
                style={{ pointerEvents: "none", userSelect: "none", letterSpacing: 0.3 }}
              >
                {p.label.length > 16 ? p.label.slice(0, 15) + "…" : p.label}
              </text>
            </g>
          ))}
        </g>
        {renderHub()}
      </svg>
      {renderPointer()}
    </div>
  );
}

export function WheelClassic(props: WheelProps) {
  return (
    <WheelBase
      {...props}
      style="classic"
      renderBezel={() => (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 0 6px rgba(255,255,255,0.95), 0 0 40px 4px ${props.primary}55, 0 12px 40px -12px rgba(0,0,0,0.5)`,
          }}
        />
      )}
      renderHub={() => (
        <>
          <defs>
            <radialGradient id="hubClassic" cx="50%" cy="45%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#f4f4f4" />
              <stop offset="100%" stopColor="#d9d9d9" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="34" fill="url(#hubClassic)" stroke="rgba(0,0,0,0.08)" />
          <circle cx="200" cy="200" r="14" fill="rgba(0,0,0,0.05)" />
        </>
      )}
      renderPointer={() => (
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: -6,
            width: 28,
            height: 34,
            background: "#ffffff",
            clipPath: "polygon(50% 100%, 0 0, 100% 0)",
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.35))",
          }}
        />
      )}
    />
  );
}

export function WheelNeon(props: WheelProps) {
  const glow = "#00e5ff";
  return (
    <WheelBase
      {...props}
      style="neon"
      containerStyle={{ filter: `drop-shadow(0 0 24px ${glow}88)` }}
      renderBezel={() => (
        <>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              boxShadow: `0 0 0 4px #0a0a12, 0 0 0 6px ${glow}, 0 0 24px ${glow}, 0 0 48px #ff2bd688 inset`,
            }}
          />
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            const R = props.size ? props.size / 2 : 150;
            return (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `calc(50% + ${Math.cos(a) * (R - 10)}px - 3px)`,
                  top: `calc(50% + ${Math.sin(a) * (R - 10)}px - 3px)`,
                  width: 6,
                  height: 6,
                  background: i % 2 ? "#fff" : glow,
                  boxShadow: `0 0 8px ${i % 2 ? "#fff" : glow}`,
                }}
              />
            );
          })}
        </>
      )}
      renderHub={() => (
        <>
          <defs>
            <radialGradient id="hubNeon" cx="50%" cy="45%" r="50%">
              <stop offset="0%" stopColor="#1b1b2f" />
              <stop offset="100%" stopColor="#000" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="38" fill="url(#hubNeon)" stroke={glow} strokeWidth={2} />
          <text x="200" y="206" textAnchor="middle" fill={glow} fontSize={14} fontWeight={900} style={{ letterSpacing: 3 }}>SPIN</text>
        </>
      )}
      renderPointer={() => (
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: -10,
            width: 32,
            height: 40,
            background: `linear-gradient(180deg, #fff, ${glow})`,
            clipPath: "polygon(50% 100%, 0 0, 100% 0)",
            filter: `drop-shadow(0 0 8px ${glow}) drop-shadow(0 0 16px ${glow})`,
          }}
        />
      )}
    />
  );
}

export function WheelGold(props: WheelProps) {
  return (
    <WheelBase
      {...props}
      style="gold"
      renderBezel={() => (
        <>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "conic-gradient(#f6c453, #a8791b, #f6c453, #7a4f0d, #f6c453, #a8791b, #f6c453)",
              padding: 8,
              boxShadow: "0 0 0 3px #0d0d10, 0 20px 40px -12px rgba(0,0,0,0.7)",
              WebkitMask: "radial-gradient(circle, transparent 60%, #000 61%)",
            }}
          />
          {Array.from({ length: 16 }).map((_, i) => {
            const a = (i / 16) * Math.PI * 2;
            const R = props.size ? props.size / 2 : 150;
            return (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `calc(50% + ${Math.cos(a) * (R - 6)}px - 4px)`,
                  top: `calc(50% + ${Math.sin(a) * (R - 6)}px - 4px)`,
                  width: 8,
                  height: 8,
                  background: "radial-gradient(circle, #fff9c4, #f6c453 50%, #7a4f0d)",
                  boxShadow: "0 0 6px #f6c45388",
                }}
              />
            );
          })}
        </>
      )}
      renderHub={() => (
        <>
          <defs>
            <radialGradient id="hubGold" cx="45%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#fff5c9" />
              <stop offset="45%" stopColor="#f6c453" />
              <stop offset="100%" stopColor="#7a4f0d" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="42" fill="url(#hubGold)" stroke="#0d0d10" strokeWidth={2} />
          <circle cx="200" cy="200" r="16" fill="#0d0d10" />
          <circle cx="200" cy="200" r="6" fill="#f6c453" />
        </>
      )}
      renderPointer={() => (
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: -8,
            width: 32,
            height: 40,
            background: "linear-gradient(180deg, #fff5c9, #f6c453 55%, #7a4f0d)",
            clipPath: "polygon(50% 100%, 0 0, 100% 0)",
            filter: "drop-shadow(0 3px 6px rgba(0,0,0,0.6))",
          }}
        />
      )}
    />
  );
}

export function WheelCandy(props: WheelProps) {
  return (
    <WheelBase
      {...props}
      style="candy"
      renderBezel={() => (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(#ff85a2, #ffbe0b, #8ac926, #4cc9f0, #b388ff, #ff85a2)",
            padding: 10,
            WebkitMask: "radial-gradient(circle, transparent 62%, #000 63%)",
            filter: "drop-shadow(0 8px 20px rgba(255, 133, 162, 0.45))",
          }}
        />
      )}
      renderHub={() => (
        <>
          <defs>
            <radialGradient id="hubCandy" cx="45%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#fff" />
              <stop offset="60%" stopColor="#ffe0f0" />
              <stop offset="100%" stopColor="#ff85a2" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="38" fill="url(#hubCandy)" stroke="#ff85a2" strokeWidth={3} />
          <text x="200" y="207" textAnchor="middle" fontSize={22}>🎁</text>
        </>
      )}
      renderPointer={() => (
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
          style={{ top: -14 }}
        >
          <div
            style={{
              width: 30,
              height: 38,
              background: "linear-gradient(180deg, #fff, #ff85a2)",
              clipPath: "polygon(50% 100%, 0 0, 100% 0)",
              filter: "drop-shadow(0 3px 6px rgba(255,133,162,0.6))",
            }}
          />
        </div>
      )}
    />
  );
}

export function WheelByStyle({ style, ...rest }: WheelProps & { style: WheelStyle }) {
  switch (style) {
    case "neon":
      return <WheelNeon {...rest} />;
    case "gold":
      return <WheelGold {...rest} />;
    case "candy":
      return <WheelCandy {...rest} />;
    case "classic":
    default:
      return <WheelClassic {...rest} />;
  }
}
