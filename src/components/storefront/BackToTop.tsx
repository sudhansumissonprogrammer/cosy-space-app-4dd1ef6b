import { useState, useEffect, useRef } from "react";
import { ChevronUp } from "lucide-react";

/** Floating back-to-top button — appears after scrolling 600px with bouncy entry/exit. */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const exitTimer = useRef<number | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const next = window.scrollY > 600;
      setVisible(next);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mount/unmount with exit animation
  useEffect(() => {
    if (visible) {
      if (exitTimer.current) { clearTimeout(exitTimer.current); exitTimer.current = null; }
      setMounted(true);
    } else if (mounted) {
      exitTimer.current = window.setTimeout(() => setMounted(false), 200);
    }
    return () => { if (exitTimer.current) clearTimeout(exitTimer.current); };
  }, [visible, mounted]);

  if (!mounted) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      data-sfg-flat="" className={`${visible ? "back-to-top-enter" : "back-to-top-exit"} sfg sfg-pill sfg-tap fixed bottom-[14rem] right-[1.75rem] z-40 flex h-11 w-11 items-center justify-center overflow-hidden rounded-full transition-[box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 active:scale-[0.96] sm:bottom-[5.5rem] sm:right-[1.75rem]`}
      style={{
        color: "var(--storefront-text, hsl(var(--foreground)))",
      }}
      aria-label="Back to top"
    >
      <ChevronUp className="relative z-10 h-5 w-5 drop-shadow-sm" strokeWidth={2.25} />
    </button>
  );
}
