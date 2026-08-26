/**
 * VideoBufferDots — three jumping dots shown while a product video is still
 * buffering (tap → first frame). Replaces the "frozen poster" feeling on slow
 * networks so shoppers wait instead of leaving.
 *
 * Pure CSS (transform/opacity only) so it composites on the GPU and costs
 * nothing while the video decoder is busy.
 */
interface Props {
  /** `sm` for product cards, `md` for the PDP gallery. */
  size?: "sm" | "md";
  /** Dim the media behind the dots (PDP) or keep it clean (cards). */
  scrim?: boolean;
  className?: string;
}

export default function VideoBufferDots({ size = "md", scrim = true, className = "" }: Props) {
  const dot = size === "sm" ? "h-1.5 w-1.5" : "h-2.5 w-2.5";
  const gap = size === "sm" ? "gap-1" : "gap-1.5";

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-[9] grid place-items-center ${scrim ? "bg-black/25" : ""} ${className}`}
      role="status"
      aria-label="Video loading"
    >
      <div className={`flex items-end ${gap}`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`${dot} rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.45)]`}
            style={{
              animation: "sf-dot-jump 900ms cubic-bezier(0.4, 0, 0.6, 1) infinite",
              animationDelay: `${i * 140}ms`,
              willChange: "transform, opacity",
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes sf-dot-jump {
          0%, 70%, 100% { transform: translateY(0); opacity: 0.55; }
          35% { transform: translateY(-60%); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
