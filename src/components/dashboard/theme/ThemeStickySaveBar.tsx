import { Save, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}

/**
 * Persistent bottom save bar (#6).
 * - Always visible when dirty
 * - Mobile: compact, sticks above bottom bar
 * - Desktop: wider, with reset button
 */
export default function ThemeStickySaveBar({ dirty, saving, onSave, onReset }: Props) {
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 z-40 flex justify-center transition-all duration-300 ${
        dirty ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0) + 12px)" }}
    >
      <div className="pointer-events-auto mx-3 flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-border bg-background/95 px-3 py-2.5 shadow-2xl ring-1 ring-foreground/5 backdrop-blur-md sm:gap-3 sm:px-4">
        <div className="flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-amber-400/70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </div>
        <p className="flex-1 truncate text-xs font-semibold text-foreground sm:text-sm">
          Unsaved theme changes
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={saving}
          className="hidden gap-1.5 text-xs sm:inline-flex"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={saving}
          className="gap-1.5 text-xs sm:text-sm"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Saving" : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
