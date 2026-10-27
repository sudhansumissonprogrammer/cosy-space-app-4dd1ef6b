/** Loaded only for non-English shoppers. Product names and numbers stay intact. */
import type { SfLang } from "./storefrontLanguage";
import { commonTranslations } from "./storefrontCommonTranslations";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "SVG", "IFRAME"]);
const ATTRS = ["placeholder", "aria-label", "title"];
const HAS_LETTERS = /[A-Za-z]{2,}/;
const originals = new WeakMap<Text, string>();
const written = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Record<string, string>>();
const attrWritten = new WeakMap<Element, Record<string, string>>();
let lang: SfLang = "en";
let observer: MutationObserver | null = null;
let memo: Record<string, string> = {};
const pending = new Map<string, boolean>();
const inFlight = new Set<string>();
const failed = new Set<string>();
const controllers = new Set<AbortController>();
let timer: number | undefined;
let active = 0;
let generation = 0;
let blocked = false;

function isProtected(el: Element | null): boolean {
  for (let n = el; n; n = n.parentElement) {
    if (SKIP_TAGS.has(n.tagName)) return true;
    if (n.getAttribute("translate") === "no" || n.classList.contains("notranslate") || n.hasAttribute("data-no-translate")) return true;
    if (n instanceof HTMLElement && n.isContentEditable) return true;
    if (n.tagName === "H1" && /\/product\//.test(location.pathname)) return true;
    if (n.tagName === "A" && /\/product\//.test(n.getAttribute("href") || "") && !el?.closest("button")) return true;
  }
  return false;
}

function queue(src: string, el: Element | null) {
  if (inFlight.has(src) || failed.has(src)) return;
  const rect = el?.getBoundingClientRect();
  const visible = !!rect && rect.bottom > 0 && rect.top < window.innerHeight;
  pending.set(src, visible || pending.get(src) === true);
}

function apply(src: string) {
  const key = src.trim();
  const translated = memo[key];
  return translated == null ? null : src.replace(key, translated);
}

function handleText(node: Text) {
  if (isProtected(node.parentElement)) return;
  const current = node.nodeValue || "";
  if (!originals.has(node) || (current !== originals.get(node) && current !== written.get(node))) originals.set(node, current);
  const src = originals.get(node);
  if (!src || !HAS_LETTERS.test(src) || src.trim().length > 2000) return;
  const out = apply(src);
  if (out != null) {
    written.set(node, out);
    if (current !== out) node.nodeValue = out;
  } else queue(src.trim(), node.parentElement);
}

function handleAttrs(el: Element) {
  // Inputs may translate placeholders, but must still honor protected ancestors.
  if (isProtected(SKIP_TAGS.has(el.tagName) ? el.parentElement : el)) return;
  const store = attrOriginals.get(el) || {};
  const last = attrWritten.get(el) || {};
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    if (store[attr] === undefined || (value !== store[attr] && value !== last[attr])) store[attr] = value;
    const src = store[attr];
    if (!HAS_LETTERS.test(src) || src.length > 2000) continue;
    const out = apply(src);
    if (out != null) {
      last[attr] = out;
      if (value !== out) el.setAttribute(attr, out);
    } else queue(src.trim(), el);
  }
  attrOriginals.set(el, store);
  attrWritten.set(el, last);
}

function walk(root: Node) {
  if (lang === "en") return;
  if (root.nodeType === Node.TEXT_NODE) { handleText(root as Text); return; }
  if (!(root instanceof Element)) return;
  if (SKIP_TAGS.has(root.tagName) && root.tagName !== "INPUT" && root.tagName !== "TEXTAREA") return;
  handleAttrs(root);
  root.querySelectorAll("[placeholder],[aria-label],[title]").forEach(handleAttrs);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) handleText(node as Text);
}

function schedule() {
  // Never reset a queued timer: carousel/countdown mutations previously postponed requests indefinitely.
  if (!pending.size || blocked || timer !== undefined || active >= 2) return;
  timer = window.setTimeout(() => { timer = undefined; flush(); }, 20);
}

async function flush() {
  if (lang === "en" || blocked || active >= 2) return;
  const batch = [...pending].sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 40).map(([src]) => src);
  if (!batch.length) return;
  batch.forEach((src) => { pending.delete(src); inFlight.add(src); });
  const reqLang = lang;
  const run = generation;
  const controller = new AbortController();
  controllers.add(controller);
  active++;
  schedule();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/translate-texts`, {
      method: "POST", signal: controller.signal,
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ lang: reqLang, texts: batch }),
    });
    const data = await res.json();
    if (run !== generation) return;
    if ([402, 403, 429].includes(res.status)) blocked = true;
    const translations = data.translations || {};
    for (const src of batch) {
      const out = translations[src];
      // Enforce the user's numeric rule, even if the translation service gets it wrong.
      if (typeof out === "string" && JSON.stringify(src.match(/[0-9]+/g)) === JSON.stringify(out.match(/[0-9]+/g))) memo[src] = out;
      else failed.add(src);
    }
    try { localStorage.setItem(`sf_tr_${reqLang}`, JSON.stringify(Object.fromEntries(Object.entries(memo).slice(-3000)))); } catch { /* quota */ }
    observer?.disconnect();
    walk(document.body);
    observe();
  } catch {
    if (run === generation) batch.forEach((src) => failed.add(src));
  } finally {
    clearTimeout(timeout);
    controllers.delete(controller);
    if (run === generation) {
      active--;
      batch.forEach((src) => inFlight.delete(src));
      schedule();
    }
  }
}

function observe() {
  observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

function restore() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node as Text;
    const original = originals.get(text);
    if (original !== undefined && text.nodeValue === written.get(text)) text.nodeValue = original;
    written.delete(text);
  }
  document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((el) => {
    const store = attrOriginals.get(el);
    const last = attrWritten.get(el);
    if (store) for (const attr in store) if (el.getAttribute(attr) === last?.[attr]) el.setAttribute(attr, store[attr]);
    attrWritten.delete(el);
  });
}

export function setTranslatorLanguage(next: SfLang) {
  if (next === lang) return;
  generation++;
  controllers.forEach((controller) => controller.abort());
  controllers.clear();
  clearTimeout(timer);
  timer = undefined;
  observer?.disconnect();
  observer = null;
  if (lang !== "en") restore();
  lang = next;
  pending.clear(); inFlight.clear(); failed.clear(); active = 0; blocked = false;
  document.documentElement.lang = next === "hi" ? "hi" : "en";
  if (next === "en") return;
  try { memo = JSON.parse(localStorage.getItem(`sf_tr_${next}`) || "{}"); } catch { memo = {}; }
  Object.assign(memo, commonTranslations[next]);
  for (const [src, translated] of Object.entries(commonTranslations[next])) memo[src.toUpperCase()] = translated;
  walk(document.body);
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") handleText(mutation.target as Text);
      else if (mutation.type === "attributes") handleAttrs(mutation.target as Element);
      else mutation.addedNodes.forEach(walk);
    }
    schedule();
  });
  observe();
  schedule();
}