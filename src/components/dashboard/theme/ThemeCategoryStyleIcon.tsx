/**
 * Mini SVG mockups for each Category Style preview tile.
 * Replaces the old ASCII-string icons (○ ○ ○, ■■■) with proper visuals.
 */
interface Props {
  style: string;
  className?: string;
}

export default function ThemeCategoryStyleIcon({ style, className = "" }: Props) {
  const wrap = `flex items-center justify-center w-full h-10 ${className}`;

  switch (style) {
    case "style-1": // Circle Carousel
      return (
        <div className={wrap}>
          <div className="flex gap-1.5 items-center">
            <div className="h-7 w-7 rounded-full bg-foreground/70" />
            <div className="h-7 w-7 rounded-full bg-foreground/50" />
            <div className="h-7 w-7 rounded-full bg-foreground/30" />
            <div className="h-7 w-7 rounded-full bg-foreground/20" />
          </div>
        </div>
      );
    case "style-2": // Square Carousel
      return (
        <div className={wrap}>
          <div className="flex gap-1.5 items-center">
            <div className="h-7 w-7 rounded-md bg-foreground/70" />
            <div className="h-7 w-7 rounded-md bg-foreground/50" />
            <div className="h-7 w-7 rounded-md bg-foreground/30" />
            <div className="h-7 w-7 rounded-md bg-foreground/20" />
          </div>
        </div>
      );
    case "style-3": // Grid Modern
      return (
        <div className={wrap}>
          <div className="grid grid-cols-3 gap-0.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-3 w-4 rounded-sm bg-foreground/60" />
            ))}
          </div>
        </div>
      );
    case "style-4": // Square Grid
      return (
        <div className={wrap}>
          <div className="grid grid-cols-2 gap-0.5">
            <div className="h-4 w-4 rounded-sm bg-foreground/70" />
            <div className="h-4 w-4 rounded-sm bg-foreground/50" />
            <div className="h-4 w-4 rounded-sm bg-foreground/40" />
            <div className="h-4 w-4 rounded-sm bg-foreground/30" />
          </div>
        </div>
      );
    case "style-5": // Pill Tags
      return (
        <div className={wrap}>
          <div className="flex flex-wrap gap-1 justify-center">
            <div className="h-3 w-7 rounded-full bg-foreground/70" />
            <div className="h-3 w-9 rounded-full bg-foreground/50" />
            <div className="h-3 w-6 rounded-full bg-foreground/40" />
            <div className="h-3 w-8 rounded-full bg-foreground/30" />
          </div>
        </div>
      );
    case "style-6": // Reveal Grid
      return (
        <div className={wrap}>
          <div className="flex flex-col gap-0.5">
            <div className="flex gap-0.5">
              <div className="h-3 w-7 rounded-sm bg-foreground/70" />
              <div className="h-3 w-7 rounded-sm bg-foreground/50" />
            </div>
            <div className="flex gap-0.5">
              <div className="h-3 w-7 rounded-sm bg-foreground/40" />
              <div className="h-3 w-7 rounded-sm bg-foreground/30" />
            </div>
          </div>
        </div>
      );
    case "style-8": // Spotlight
      return (
        <div className={wrap}>
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full bg-foreground/30" />
            <div className="h-7 w-7 rounded-full bg-foreground/80 ring-2 ring-foreground/20" />
            <div className="h-4 w-4 rounded-full bg-foreground/30" />
          </div>
        </div>
      );
    case "style-10": // Magazine
      return (
        <div className={wrap}>
          <div className="grid grid-cols-2 gap-0.5">
            <div className="h-4 w-8 rounded-sm bg-foreground/70" />
            <div className="h-4 w-8 rounded-sm bg-foreground/40" />
            <div className="h-4 w-8 rounded-sm bg-foreground/30" />
            <div className="h-4 w-8 rounded-sm bg-foreground/60" />
          </div>
        </div>
      );
    case "style-11": // 2-Row Circles
      return (
        <div className={wrap}>
          <div className="flex flex-col gap-0.5">
            <div className="flex gap-0.5">
              <div className="h-3 w-3 rounded-full bg-foreground/70" />
              <div className="h-3 w-3 rounded-full bg-foreground/60" />
              <div className="h-3 w-3 rounded-full bg-foreground/50" />
            </div>
            <div className="flex gap-0.5">
              <div className="h-3 w-3 rounded-full bg-foreground/40" />
              <div className="h-3 w-3 rounded-full bg-foreground/30" />
              <div className="h-3 w-3 rounded-full bg-foreground/20" />
            </div>
          </div>
        </div>
      );
    default:
      return <div className={wrap}><div className="h-6 w-6 rounded bg-foreground/40" /></div>;
  }
}
