import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Languages, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { getSfLang, setSfLang, type SfLang } from "@/lib/storefrontLanguage";

const OPTIONS: { id: SfLang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिंदी" },
  { id: "hinglish", label: "Hinglish" },
];

const SHORT: Record<SfLang, string> = { en: "EN", hi: "हिं", hinglish: "HIN" };

function runTranslator() {
  import("@/lib/storefrontTranslator").then((m) => m.setTranslatorLanguage(getSfLang())).catch(() => {});
}

/** Body portal takes no layout space and stays clear of right-hand storefront overlays. */
export default function LanguageStrip() {
  const [lang, setLang] = useState<SfLang>(getSfLang);
  const [hint, setHint] = useState(false);
  const [shown, setShown] = useState(true);

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

  const corner = "fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-2 z-30 sm:bottom-5 sm:left-3";

  const closed = (
    <div translate="no" className={`notranslate ${corner}`} role="region" aria-label="Language">
      <button
        type="button"
        aria-label="Change language"
        title="Change language"
        onClick={() => setShown(true)}
        className={`grid h-6 w-6 place-items-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground ${hint ? "sf-lang-hint" : ""}`}
      >
        <Languages className={`h-3 w-3 ${hint ? "sf-lang-icon" : ""}`} aria-hidden="true" />
      </button>
    </div>
  );

  const open = (
    <div translate="no" className={`notranslate ${corner}`} role="region" aria-label="Language">
      <div className={`inline-flex h-6 items-center gap-0.5 rounded-full border border-border bg-background pl-1.5 pr-0.5 text-[10px] text-foreground shadow-sm ${hint ? "sf-lang-hint" : ""}`}>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" aria-label="Choose language" title="Choose language: English / हिंदी / Hinglish" className="h-5 gap-1 rounded-full bg-transparent px-1 py-0 text-[10px] font-medium text-foreground hover:bg-transparent">
              <Languages className={`h-3 w-3 ${hint ? "sf-lang-icon" : ""}`} aria-hidden="true" />
              <span>{SHORT[lang]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" translate="no" className="notranslate min-w-28">
            <DropdownMenuRadioGroup value={lang} onValueChange={(value) => { if (value === "en" || value === "hi" || value === "hinglish") choose(value); }}>
              {OPTIONS.map((option) => <DropdownMenuRadioItem key={option.id} value={option.id}>{option.label}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          aria-label="Close language selector"
          title="Close"
          onClick={() => { setShown(false); setHint(false); }}
          className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-2.5 w-2.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );

  return createPortal(shown ? open : closed, document.body);
}
