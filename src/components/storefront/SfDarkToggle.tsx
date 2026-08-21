import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Moon, Sun } from "lucide-react";
import {
  SF_DARK_EVENT,
  applySfDarkClass,
  isCheckoutPath,
  readSfDark,
  setSfDark,
} from "@/lib/sfDarkMode";

/**
 * Premium night-mode toggle — Theme 16 (Classic + Quick Buy) only.
 * Light is the default; the dark palette is opt-in and never applies on checkout.
 */
export default function SfDarkToggle({ size = 40 }: { size?: number }) {
  const { pathname } = useLocation();
  const [dark, setDark] = useState<boolean>(() => readSfDark());

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
    };
  }, []);

  if (isCheckoutPath(pathname)) return null;

  return (
    <button
      type="button"
      onClick={() => setSfDark(!dark)}
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
        {dark ? <Sun className="h-[18px] w-[18px]" strokeWidth={2} /> : <Moon className="h-[18px] w-[18px]" strokeWidth={2} />}
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
