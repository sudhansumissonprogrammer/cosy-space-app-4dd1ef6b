/**
 * Tiny animated thumbnail for the "Night Mode Switch Effect" picker in
 * Theme Settings. Pure CSS, animates only while hovered or selected so the
 * dashboard stays idle-cheap.
 */
export default function DarkEffectPreview({
  variant,
  active,
}: {
  variant: string;
  active: boolean;
}) {
  const cls = `dfx dfx-${variant} ${active ? "dfx-on" : ""}`;
  return (
    <div className={cls} aria-hidden>
      <div className="dfx-sky">
        <span className="dfx-line" />
        <span className="dfx-line dfx-line-2" />
      </div>
      {variant === "blinds" ? (
        <div className="dfx-blinds">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      ) : (
        <div className="dfx-ink" />
      )}
      <style>{`
        .dfx { position: relative; width: 100%; height: 44px; border-radius: 8px; overflow: hidden;
               background: #f6f6f7; border: 1px solid hsl(var(--border)); }
        .dfx-sky { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:center; gap:5px; padding:0 10px; }
        .dfx-line { display:block; height:4px; border-radius:2px; background:#c9ccd2; width:70%; }
        .dfx-line-2 { width:45%; }
        .dfx-ink { position:absolute; inset:0; background:#0a0a0a; }
        .dfx-blinds { position:absolute; inset:0; display:flex; }
        .dfx-blinds span { flex:1; background:#0a0a0a; transform:scaleY(0); transform-origin:top; }

        /* resting state: half covered so each tile reads at a glance */
        .dfx-spotlight .dfx-ink { clip-path: circle(14px at 78% 50%); }
        .dfx-curtain .dfx-ink { transform: translateY(-55%); }
        .dfx-eclipse .dfx-ink { clip-path: circle(15px at 50% 50%);
          background: radial-gradient(circle, #0a0a0a 60%, #171717 74%, rgba(255,214,138,.75) 80%, rgba(255,214,138,0) 90%); }
        .dfx-dissolve .dfx-ink { opacity: .55; }
        .dfx-blinds span { transform: scaleY(.55); }
        .dfx-none .dfx-ink { clip-path: inset(0 0 0 50%); }

        /* animate on hover or when this effect is the selected one */
        .dfx:hover .dfx-ink, .dfx-on .dfx-ink { animation-duration: 2.4s; animation-iteration-count: infinite; animation-timing-function: cubic-bezier(.65,0,.35,1); }
        .dfx-spotlight:hover .dfx-ink, .dfx-spotlight.dfx-on .dfx-ink { animation-name: dfx-spot; }
        .dfx-curtain:hover .dfx-ink, .dfx-curtain.dfx-on .dfx-ink { animation-name: dfx-curtain; }
        .dfx-eclipse:hover .dfx-ink, .dfx-eclipse.dfx-on .dfx-ink { animation-name: dfx-eclipse; }
        .dfx-dissolve:hover .dfx-ink, .dfx-dissolve.dfx-on .dfx-ink { animation-name: dfx-dissolve; }
        .dfx-blinds:hover .dfx-blinds span, .dfx-blinds.dfx-on .dfx-blinds span {
          animation: dfx-slat 2.4s infinite cubic-bezier(.65,0,.35,1); }

        @keyframes dfx-spot { 0%{clip-path:circle(0px at 78% 50%);} 45%,55%{clip-path:circle(70px at 78% 50%);} 100%{clip-path:circle(0px at 78% 50%);} }
        @keyframes dfx-curtain { 0%{transform:translateY(-100%);} 45%,55%{transform:translateY(0);} 100%{transform:translateY(100%);} }
        @keyframes dfx-eclipse { 0%{clip-path:circle(0px at 50% 50%);} 45%,55%{clip-path:circle(70px at 50% 50%);} 100%{clip-path:circle(0px at 50% 50%);} }
        @keyframes dfx-dissolve { 0%{opacity:0;} 45%,55%{opacity:1;} 100%{opacity:0;} }
        @keyframes dfx-slat { 0%{transform:scaleY(0);} 45%,55%{transform:scaleY(1);} 100%{transform:scaleY(0);} }

        @media (prefers-reduced-motion: reduce) {
          .dfx .dfx-ink, .dfx .dfx-blinds span { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
