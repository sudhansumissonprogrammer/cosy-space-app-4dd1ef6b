import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import {
  SF_DARK_EVENT,
  applySfDarkClass,
  isCheckoutPath,
  readSfDark,
  setSfDark,
} from "@/lib/sfDarkMode";
import {
  cancelSfDarkTransition,
  normalizeSfDarkEffect,
  runSfDarkTransition,
  type SfDarkEffect,
} from "@/lib/sfDarkTransition";

/**
 * Premium night-mode toggle — Theme 16 (Classic + Quick Buy) only.
 * Light is the default; the dark palette is opt-in and never applies on checkout.
 * The switch animation is chosen by the merchant in Theme Settings.
 */
export default function SfDarkToggle({
  size = 32,
  effect,
}: {
  size?: number;
  effect?: string | null;
}) {
  const { pathname } = useLocation();
  const [dark, setDark] = useState<boolean>(() => readSfDark());
  const btnRef = useRef<HTMLButtonElement>(null);
  const busyRef = useRef(false);
  const chosen: SfDarkEffect = normalizeSfDarkEffect(effect);

  // Keep <html> in sync: honor the preference everywhere except checkout.
  useEffect(() => {
    applySfDarkClass(dark && !isCheckoutPath(pathname));
  }, [dark, pathname]);

  // Sync across header instances (mobile + desktop) and other tabs.
  useEffect(() => {
    const onChange = (e: Event) => setDark(!!(e as CustomEvent).detail);
    const onStorage = () => setDark(readSfDark());
    window.addEventListener(SF_DARK_EVENT, onChange as EventListener);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SF_DARK_EVENT, onChange as EventListener);
      window.removeEventListener("storage", onStorage);
      // The animation overlay lives on document.body, so it survives React
      // teardown — drop it or it eats clicks on the next screen.
      cancelSfDarkTransition();
    };
  }, []);

  if (isCheckoutPath(pathname)) return null;

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const next = !dark;
    // Prefer the exact tap point (finger position on mobile), fall back to the
    // button's own centre for keyboard/synthetic activation. Both are viewport
    // coordinates; the transition maps them onto the overlay.
    const rect = btnRef.current?.getBoundingClientRect();
    const fromPointer = e.detail > 0 && (e.clientX !== 0 || e.clientY !== 0);
    const origin = fromPointer
      ? { x: e.clientX, y: e.clientY }
      : rect && rect.width > 0
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : null;
    try {
      await runSfDarkTransition(chosen, origin, next, () => setSfDark(next));
    } finally {
      busyRef.current = false;
    }
  };


  return (
    <button
      ref={btnRef}
      type="button"
      onClick={handleClick}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to night mode"}
      title={dark ? "Light mode" : "Night mode"}
      className="sf-dark-toggle relative flex items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        border: "1px solid color-mix(in srgb, var(--storefront-text, #1a1a1a) 14%, transparent)",
        backgroundColor: "color-mix(in srgb, var(--storefront-text, #1a1a1a) 6%, transparent)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: "var(--storefront-text, #1a1a1a)",
      }}
    >
      <span className="sf-dark-toggle-glyph" key={dark ? "sun" : "moon"}>
        {dark ? <Sun className="h-[15px] w-[15px]" strokeWidth={2} /> : <Moon className="h-[15px] w-[15px]" strokeWidth={2} />}
      </span>
      <style>{`
        .sf-dark-toggle { transition: background-color .2s ease, border-color .2s ease; }
        .sf-dark-toggle:active { transform: scale(.96); }
        .sf-dark-toggle-glyph { display:flex; animation: sf-dark-glyph .2s ease-out both; }
        @keyframes sf-dark-glyph { from { opacity:0; transform: rotate(-35deg) scale(.8);} to { opacity:1; transform:none; } }
        @media (prefers-reduced-motion: reduce) {
          .sf-dark-toggle, .sf-dark-toggle-glyph { transition: none; animation: none; }
        }
      `}</style>
    </button>
  );
}
