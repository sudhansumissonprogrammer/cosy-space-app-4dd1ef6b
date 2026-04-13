import { useState, useEffect } from "react";
import { ChevronUp } from "lucide-react";

/** Floating back-to-top button — appears after scrolling 600px */
export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-20 right-4 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 sm:bottom-6 sm:right-6"
      style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}
      aria-label="Back to top"
    >
      <ChevronUp className="h-5 w-5" />
    </button>
  );
}
