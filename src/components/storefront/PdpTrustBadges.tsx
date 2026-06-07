/**
 * PdpTrustBadges — Horizontal scrollable pill carousel shown above the
 * product title on PDP. Each pill = emoji + label.
 *
 * Layout-safe: stays fully inside the info column, never bleeds past
 * parent padding, never affects sibling grid columns (no negative
 * margins, width is constrained, overflow is scoped to this row).
 */
export interface TrustBadgeItem {
  emoji: string;
  label: string;
}

interface Props {
  badges: TrustBadgeItem[];
}

export default function PdpTrustBadges({ badges }: Props) {
  if (!badges || badges.length === 0) return null;
  return (
    <div className="w-full max-w-full min-w-0 mb-3">
      <div
        className="flex gap-2 overflow-x-auto pb-1 no-scrollbar snap-x"
        style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
      >
        {badges.map((b, i) => {
          const filled = i % 4 < 2;
          return (
            <span
              key={`${b.label}-${i}`}
              className="shrink-0 snap-start inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none whitespace-nowrap"
              style={
                filled
                  ? {
                      background: "linear-gradient(180deg, #4a1f12 0%, #2d1108 100%)",
                      color: "#fff8ec",
                      border: "1px solid rgba(255,255,255,0.08)",
                      boxShadow: "0 1px 3px rgba(45,17,8,0.25), inset 0 1px 0 rgba(255,255,255,0.08)",
                    }
                  : {
                      background: "#f5efe2",
                      color: "#3b1c10",
                      border: "1px solid rgba(59,28,16,0.18)",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                    }
              }
            >
              <span className="text-[14px] leading-none" aria-hidden="true">
                {b.emoji}
              </span>
              <span style={{ fontFamily: "var(--storefront-heading-font, 'Alegreya SC'), serif" }}>
                {b.label}
              </span>
            </span>
          );
        })}
        <style>{`.no-scrollbar::-webkit-scrollbar{display:none}`}</style>
      </div>
    </div>
  );
}
