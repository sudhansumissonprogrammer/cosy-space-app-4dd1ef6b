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
      className={`${visible ? "back-to-top-enter" : "back-to-top-exit"} fixed bottom-[10.5rem] right-[1.75rem] z-40 flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-xl backdrop-saturate-150 transition-[box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 active:scale-[0.96] sm:bottom-[5.5rem] sm:right-[1.75rem]`}
      style={{
        color: "var(--storefront-text, hsl(var(--foreground)))",
        backgroundColor: "color-mix(in srgb, var(--storefront-bg, hsl(var(--card))) 45%, transparent)",
        border: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 14%, transparent)",
        boxShadow:
          "0 8px 24px -8px rgba(0,0,0,0.28), inset 0 1px 0 color-mix(in srgb, #fff 45%, transparent)",
        WebkitBackdropFilter: "blur(16px) saturate(150%)",
      }}
      aria-label="Back to top"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}
