import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SettingsTab {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface Props {
  tabs: SettingsTab[];
}

/**
 * Sticky scroll-spy tab nav for long settings forms. Clicking a tab smooth-
 * scrolls to the section with the matching `id`. As the user scrolls, the
 * active tab updates via IntersectionObserver.
 */
export default function SettingsTabsNav({ tabs }: Props) {
  const [active, setActive] = useState<string>(tabs[0]?.id || "");
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sections = tabs
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [tabs]);

  // Keep the active chip scrolled into view in the horizontal nav.
  useEffect(() => {
    const el = navRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab-id="${active}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [active]);

  const onClick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    const top = el.getBoundingClientRect().top + window.scrollY - 110;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <div className="sticky top-0 z-30 -mx-4 sm:mx-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b">
      <div
        ref={navRef}
        className="flex gap-1 overflow-x-auto px-4 sm:px-0 py-2 scrollbar-hide"
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              type="button"
              data-tab-id={t.id}
              onClick={() => onClick(t.id)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors border",
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-input hover:bg-accent",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
