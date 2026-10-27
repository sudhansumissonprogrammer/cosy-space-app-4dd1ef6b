import { useEffect, useState } from "react";
import { Languages } from "lucide-react";
import { getSfLang, setSfLang, type SfLang } from "@/lib/storefrontLanguage";

const OPTIONS: { id: SfLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
  { id: "hinglish", label: "Hinglish" },
];

function runTranslator(lang: SfLang) {
  import("@/lib/storefrontTranslator").then((m) => m.setTranslatorLanguage(lang)).catch(() => {});
}

/** Slim, optional language strip shown on every storefront. English loads nothing extra. */
export default function LanguageStrip() {
  const [lang, setLang] = useState<SfLang>(getSfLang);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (lang !== "en") {
      const idle: any = (window as any).requestIdleCallback;
      idle ? idle(() => runTranslator(lang), { timeout: 1500 }) : setTimeout(() => runTranslator(lang), 600);
    }
    try {
      if (!localStorage.getItem("sf_lang_seen")) {
        setHint(true);
        localStorage.setItem("sf_lang_seen", "1");
        setTimeout(() => setHint(false), 3500);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (next: SfLang) => {
    if (next === lang) return;
    setLang(next);
    setSfLang(next);
    setHint(false);
    runTranslator(next);
  };

  return (
    <div
      translate="no"
      className={`notranslate sf-lang-strip w-full border-b border-border bg-muted/70 text-foreground ${hint ? "sf-lang-hint" : ""}`}
      role="region"
      aria-label="Language"
    >
      <div className="mx-auto flex h-7 max-w-7xl items-center justify-center gap-2 px-3 text-[11px] sm:text-xs">
        <Languages className={`h-3.5 w-3.5 opacity-70 ${hint ? "sf-lang-icon" : ""}`} aria-hidden="true" />
        <div className="flex items-center rounded-full border border-border bg-background/80 p-0.5" role="radiogroup" aria-label="Choose language">
          {OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={lang === o.id}
              onClick={() => choose(o.id)}
              className={`rounded-full px-2.5 py-0.5 font-medium leading-4 transition-colors ${
                lang === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
