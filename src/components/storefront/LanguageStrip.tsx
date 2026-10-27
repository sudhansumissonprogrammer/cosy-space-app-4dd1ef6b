import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { getSfLang, setSfLang, type SfLang } from "@/lib/storefrontLanguage";

const OPTIONS: { id: SfLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
  { id: "hinglish", label: "Hinglish" },
];

function runTranslator(lang: SfLang) {
  import("@/lib/storefrontTranslator").then((m) => m.setTranslatorLanguage(getSfLang())).catch(() => {});
}

/** Shared below-header control. The portal preserves each theme's header/main sibling rules. */
export default function LanguageStrip() {
  const [lang, setLang] = useState<SfLang>(getSfLang);
  const [hint, setHint] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const shell = anchorRef.current?.closest('[data-storefront-ready="true"]');
    if (!shell) return;
    const slot = document.createElement("div");
    slot.className = "sf-language-slot";
    const place = () => {
      const main = shell.querySelector("main");
      if (main && slot.parentElement !== main) main.prepend(slot);
      if (slot.isConnected) setHost(slot);
    };
    place();
    const observer = new MutationObserver(place);
    observer.observe(shell, { childList: true, subtree: true });
    return () => { observer.disconnect(); slot.remove(); };
  }, []);

  useEffect(() => {
    if (lang !== "en") {
      runTranslator(lang);
    }
    try {
      if (!localStorage.getItem("sf_lang_seen")) {
        setHint(true);
        localStorage.setItem("sf_lang_seen", "1");
        const timer = setTimeout(() => setHint(false), 3500);
        return () => clearTimeout(timer);
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

  const selector = (
    <div translate="no" className="notranslate mx-auto flex h-8 max-w-7xl items-center justify-end px-3" role="region" aria-label="Language">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" aria-label="Choose language" title="Choose language" className={`h-6 gap-1.5 rounded-md border border-border bg-background px-2 text-[11px] text-foreground ${hint ? "sf-lang-hint" : ""}`}>
            <Languages className={`h-3.5 w-3.5 ${hint ? "sf-lang-icon" : ""}`} aria-hidden="true" />
            <span>{OPTIONS.find((option) => option.id === lang)?.label}</span>
            <ChevronDown className="h-3 w-3 opacity-60" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" translate="no" className="notranslate min-w-32">
          <DropdownMenuRadioGroup value={lang} onValueChange={(value) => { if (value === "en" || value === "hi" || value === "hinglish") choose(value); }}>
            {OPTIONS.map((option) => <DropdownMenuRadioItem key={option.id} value={option.id}>{option.label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  return <><span ref={anchorRef} hidden />{host && createPortal(selector, host)}</>;
}
