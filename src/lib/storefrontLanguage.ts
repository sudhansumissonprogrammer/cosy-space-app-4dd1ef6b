export type SfLang = "en" | "hi" | "hinglish";
const KEY = "sf_lang";

export function getSfLang(): SfLang {
  try {
    const v = localStorage.getItem(KEY);
    return v === "hi" || v === "hinglish" ? v : "en";
  } catch {
    return "en";
  }
}

export function setSfLang(lang: SfLang) {
  try { localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("sf:lang", { detail: lang }));
}
