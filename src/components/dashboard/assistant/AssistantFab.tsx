import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "sf_assistant_fab_hint_v1";

interface Props {
  onClick: () => void;
  hidden?: boolean;
}

/**
 * Floating "Ask AI" button for the mobile dashboard.
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
    <div className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.75rem)] z-40 flex flex-col items-end gap-2 md:hidden">
      {showHint && (
        <div className="animate-fade-in flex max-w-[15rem] items-start gap-2 rounded-2xl rounded-br-sm border bg-card px-3 py-2 shadow-lg">
          <button
            type="button"
            onClick={() => {
              dismissHint();
              onClick();
            }}
            className="text-left"
          >
            <span className="block text-[13px] font-semibold text-foreground">Need help?</span>
            <span className="block text-[11px] leading-snug text-muted-foreground">
              Ask me how to add payments, shipping, pixel — anything.
            </span>
          </button>
          <button
            type="button"
            onClick={dismissHint}
            aria-label="Dismiss assistant tip"
            className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground active:bg-accent"
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
        className={cn(
          "relative flex h-14 items-center gap-2 rounded-full bg-primary pl-4 pr-5 text-primary-foreground shadow-xl",
          "transition-transform active:scale-95",
        )}
      >
        <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-primary/30" aria-hidden />
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-semibold">Ask AI</span>
      </button>
    </div>
  );
}
