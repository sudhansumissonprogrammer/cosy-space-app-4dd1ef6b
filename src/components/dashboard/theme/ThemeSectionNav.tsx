import { LucideIcon } from "lucide-react";

export type ThemeSectionId =
  | "template"
  | "colors"
  | "typography"
  | "layout"
  | "header"
  | "cards"
  | "categories"
  | "extras";

export interface ThemeSectionMeta {
  id: ThemeSectionId;
  label: string;
  icon: LucideIcon;
  description: string;
}

interface Props {
  sections: ThemeSectionMeta[];
  active: ThemeSectionId;
  onSelect: (id: ThemeSectionId) => void;
  configuredMap?: Partial<Record<ThemeSectionId, boolean>>;
}

/**
 * Tabbed section navigation (#3).
 * - Desktop: vertical sidebar with icons + labels
 * - Mobile: horizontal scrolling pill row, sticks under header
 */
export default function ThemeSectionNav({ sections, active, onSelect, configuredMap = {} }: Props) {
  return (
    <>
      {/* Desktop: vertical sidebar */}
      <nav className="hidden lg:flex flex-col gap-1 sticky top-4">
        {sections.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          const isConfigured = configuredMap[s.id];
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${
                isActive
                  ? "border-foreground/15 bg-accent shadow-sm"
                  : "border-transparent hover:bg-accent/50"
              }`}
            >
              <div
                className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
                  isActive ? "bg-foreground text-background" : "bg-muted text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold">{s.label}</span>
                  {isConfigured && (
                    <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" title="Customized" />
                  )}
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground line-clamp-1">{s.description}</p>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Mobile/Tablet: horizontal scrolling pills */}
      <div className="lg:hidden -mx-4 sm:-mx-6 px-4 sm:px-6 sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border py-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {sections.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.id;
            const isConfigured = configuredMap[s.id];
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={`flex-shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted text-foreground hover:bg-muted/70"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{s.label}</span>
                {isConfigured && !isActive && (
                  <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
