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
      className={`${visible ? "back-to-top-enter" : "back-to-top-exit"} fixed bottom-20 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-shadow duration-300 hover:shadow-xl active:scale-95 sm:bottom-6 sm:right-6`}
      style={{
        color: "var(--storefront-text, hsl(var(--foreground)))",
        backgroundColor: "var(--storefront-bg, hsl(var(--card)))",
        border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 12%, transparent)",
      }}
      aria-label="Back to top"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}
