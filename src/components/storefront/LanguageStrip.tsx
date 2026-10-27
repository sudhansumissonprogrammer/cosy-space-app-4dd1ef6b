import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { getSfLang, setSfLang, type SfLang } from "@/lib/storefrontLanguage";

const OPTIONS: { id: SfLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
  { id: "hinglish", label: "Hinglish" },
];

function runTranslator() {
  import("@/lib/storefrontTranslator").then((m) => m.setTranslatorLanguage(getSfLang())).catch(() => {});
}

/** Body portal takes no layout space and stays clear of right-hand storefront overlays. */
export default function LanguageStrip() {
  const [lang, setLang] = useState<SfLang>(getSfLang);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (lang !== "en") {
      runTranslator();
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
    runTranslator();
  };

  const selector = (
    <div translate="no" className="notranslate fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-2 z-30 sm:bottom-5 sm:left-3" role="region" aria-label="Language">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" aria-label="Choose language" title="Choose language: English / हिंदी / Hinglish" className={`h-8 w-16 gap-1 rounded-md border border-border bg-background px-1.5 text-[11px] text-foreground shadow-sm ${hint ? "sf-lang-hint" : ""}`}>
            <Languages className={`h-3.5 w-3.5 ${hint ? "sf-lang-icon" : ""}`} aria-hidden="true" />
            <span>{lang === "en" ? "EN" : lang === "hi" ? "हिंदी" : "HIN"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" translate="no" className="notranslate min-w-32">
          <DropdownMenuRadioGroup value={lang} onValueChange={(value) => { if (value === "en" || value === "hi" || value === "hinglish") choose(value); }}>
            {OPTIONS.map((option) => <DropdownMenuRadioItem key={option.id} value={option.id}>{option.label}</DropdownMenuRadioItem>)}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  return createPortal(selector, document.body);
}
