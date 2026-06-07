/**
 * PdpTrustBadges — Horizontal scrollable pill carousel shown above the
 * product title on PDP. Each pill = emoji + label. Designed to build trust
 * and showcase use-cases (Daily Wear, Office, Festive, Wedding, etc).
 *
 * Visual reference: dark brown filled pills + cream outlined pills.
 * The first two pills get the "filled" treatment for visual rhythm,
 * the rest use the outline treatment — matches uploaded reference.
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
    <div className="-mx-4 sm:mx-0 mb-3">
      <div
        className="flex gap-2 overflow-x-auto px-4 sm:px-0 pb-1 no-scrollbar snap-x"
        style={{ scrollbarWidth: "none" }}
      >
        {badges.map((b, i) => {
          const filled = i % 4 < 2; // alternate pairs filled/outlined for rhythm
          return (
            <span
              key={`${b.label}-${i}`}
              className="shrink-0 snap-start inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold leading-none whitespace-nowrap transition-transform active:scale-95"
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
              <span className="text-[15px] leading-none" aria-hidden="true">
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
