import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";

const DISMISS_KEY = "sf_assistant_fab_hint_v1";

interface Props {
  onClick: () => void;
  hidden?: boolean;
}

/**
 * Premium floating "Ask AI" button for the mobile dashboard.
 * Sits above the bottom nav, shows a one-time invite bubble for new store owners.
 */
export default function AssistantFab({ onClick, hidden }: Props) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (hidden) return;
    let dismissed = true;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* storage blocked — stay quiet */
    }
    if (dismissed) return;
    const t = setTimeout(() => setShowHint(true), 1200);
    return () => clearTimeout(t);
  }, [hidden]);

  const dismissHint = () => {
    setShowHint(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (hidden) return null;

  return (
    <div className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.9rem)] z-40 flex flex-col items-end gap-2.5 md:hidden">
      {showHint && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex max-w-[16rem] items-start gap-2 rounded-2xl rounded-br-md border border-border/60 bg-card/95 px-3.5 py-2.5 shadow-[0_12px_32px_-12px_hsl(var(--foreground)/0.35)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => {
              dismissHint();
              onClick();
            }}
            className="text-left"
          >
            <span className="block text-[13px] font-semibold tracking-tight text-foreground">
              Need a hand?
            </span>
            <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
              Payments, shipping, pixel, domain — ask me and I'll walk you through it.
            </span>
          </button>
          <button
            type="button"
            onClick={dismissHint}
            aria-label="Dismiss assistant tip"
            className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground/70 active:bg-accent"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          dismissHint();
          onClick();
        }}
        aria-label="Ask the Store Assistant"
        className="group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-primary-foreground/20 bg-primary text-primary-foreground shadow-[0_10px_24px_-6px_hsl(var(--primary)/0.72),0_2px_8px_-2px_hsl(var(--foreground)/0.12)] transition-all duration-200 active:scale-[0.92] active:shadow-[0_6px_16px_-4px_hsl(var(--primary)/0.55)]"
      >
        {/* soft moving sheen */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full animate-shimmer opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(110deg, transparent 38%, hsl(var(--primary-foreground) / 0.35) 50%, transparent 62%)",
          }}
        />
        {/* pop ring */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-primary-foreground/15"
        />
        {/* subtle outer glow pulse */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-1 -z-10 rounded-full bg-primary/30 blur-md animate-pulse"
        />
        <Sparkles className="relative h-5 w-5" strokeWidth={2.2} />
      </button>
    </div>
  );
}
