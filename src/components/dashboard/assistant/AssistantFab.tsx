import { Sparkles } from "lucide-react";

interface Props {
  onClick: () => void;
  hidden?: boolean;
}

/** Small floating "Ask AI" icon for the mobile dashboard. No popups. */
export default function AssistantFab({ onClick, hidden }: Props) {
  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Ask the Store Assistant"
      className="fixed right-4 bottom-[calc(4rem+env(safe-area-inset-bottom,0px)+0.9rem)] z-40 flex h-9 w-9 items-center justify-center rounded-full border border-primary-foreground/20 bg-primary text-primary-foreground shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.7)] transition-transform active:scale-90 md:hidden"
    >
      <Sparkles className="h-4 w-4" strokeWidth={2.2} />
    </button>
  );
}
