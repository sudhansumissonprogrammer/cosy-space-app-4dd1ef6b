/**
 * Loaded ONLY when a shopper picks Hindi/Hinglish. Translates visible text,
 * keeping product names (product links, PDP h1, .notranslate) and numbers
 * unchanged. Results cached locally + server-side.
 */
import type { SfLang } from "./storefrontLanguage";

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE", "SVG", "IFRAME"]);
const ATTRS = ["placeholder", "aria-label", "title"];
const HAS_LETTERS = /[A-Za-z]{2,}/;

const originals = new WeakMap<Text, string>();
const attrOriginals = new WeakMap<Element, Record<string, string>>();
let lang: SfLang = "en";
let observer: MutationObserver | null = null;
let memo: Record<string, string> = {};
const pending = new Set<string>();
let timer: number | undefined;
let blocked = false;

const cacheKey = (l: string) => `sf_tr_${l}`;
function loadCache(l: string) {
  try { memo = JSON.parse(localStorage.getItem(cacheKey(l)) || "{}"); } catch { memo = {}; }
}
function saveCache() {
  try {
    const entries = Object.entries(memo);
    const trimmed = entries.length > 3000 ? Object.fromEntries(entries.slice(-3000)) : memo;
    localStorage.setItem(cacheKey(lang), JSON.stringify(trimmed));
  } catch { /* quota */ }
}

function isProtected(el: Element | null): boolean {
  for (let n: Element | null = el; n; n = n.parentElement) {
    if (SKIP_TAGS.has(n.tagName)) return true;
    if (n.getAttribute("translate") === "no" || n.classList.contains("notranslate") || n.hasAttribute("data-no-translate")) return true;
    if (n.isContentEditable) return true;
    // Product names: headings/title text inside product links, and the PDP title.
    if (n.tagName === "H1" && /\/product\//.test(location.pathname)) return true;
    if (n.tagName === "A" && /\/product\//.test(n.getAttribute("href") || "")) {
      if (!el?.closest("button")) return true;
    }
  }
  return false;
}

function core(s: string) { return s.trim(); }
function apply(text: string, src: string) {
  const c = core(src);
  const t = memo[c];
  if (t == null) return null;
  return src.replace(c, t);
}

function handleText(node: Text) {
  const current = node.nodeValue || "";
  const orig = originals.get(node);
  // React may have changed content: treat new content as new original.
  if (orig === undefined || (current !== orig && apply(node, orig) !== current)) originals.set(node, current);
  const src = originals.get(node)!;
  const c = core(src);
  if (!c || !HAS_LETTERS.test(c) || c.length > 2000) return;
  if (isProtected(node.parentElement)) return;
  const out = apply(node, src);
  if (out != null) { if (node.nodeValue !== out) node.nodeValue = out; }
  else pending.add(c);
}
// apply signature helper for compare
function applyNode(_: Text, s: string) { return apply(_ as any, s); }
void applyNode;

function handleAttrs(el: Element) {
  if (isProtected(el.parentElement) && el.tagName !== "INPUT") return;
  let store = attrOriginals.get(el);
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v || !HAS_LETTERS.test(v)) continue;
    store ||= {};
    if (store[a] === undefined || (v !== store[a] && v !== memo[core(store[a])])) store[a] = v;
    const t = memo[core(store[a])];
    if (t != null) { if (v !== t) el.setAttribute(a, t); }
    else pending.add(core(store[a]));
  }
  if (store) attrOriginals.set(el, store);
}

function walk(root: Node) {
  if (lang === "en") return;
  if (root.nodeType === 3) { handleText(root as Text); return; }
  if (root.nodeType !== 1) return;
  const el = root as Element;
  if (SKIP_TAGS.has(el.tagName) && el.tagName !== "INPUT" && el.tagName !== "TEXTAREA") return;
  handleAttrs(el);
  el.querySelectorAll("[placeholder],[aria-label],[title]").forEach(handleAttrs);
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = tw.nextNode())) handleText(n as Text);
  schedule();
}

function schedule() {
  if (!pending.size || blocked) return;
  clearTimeout(timer);
  timer = window.setTimeout(flush, 250);
}

async function flush() {
  const batch = Array.from(pending).slice(0, 60);
  batch.forEach((b) => pending.delete(b));
  if (!batch.length) return;
  const reqLang = lang;
  try {
    const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/translate-texts`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ lang: reqLang, texts: batch }),
    });
    if ([402, 403, 429].includes(res.status)) blocked = true;
    const data = await res.json().catch(() => ({}));
    if (reqLang !== lang) return;
    Object.assign(memo, data.translations || {});
    saveCache();
    walk(document.body);
  } catch { /* offline: keep English */ }
  if (pending.size) schedule();
}

function restore() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const o = originals.get(n as Text);
    if (o !== undefined && n.nodeValue !== o) n.nodeValue = o;
  }
  document.querySelectorAll("[placeholder],[aria-label],[title]").forEach((el) => {
    const s = attrOriginals.get(el);
    if (s) for (const a in s) el.setAttribute(a, s[a]);
  });
}

export function setTranslatorLanguage(next: SfLang) {
  if (next === lang) return;
  observer?.disconnect();
  observer = null;
  if (lang !== "en") restore();
  lang = next;
  pending.clear();
  document.documentElement.lang = next === "hi" ? "hi" : "en";
  if (next === "en") return;
  loadCache(next);
  walk(document.body);
  observer = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") handleText(m.target as Text);
      else if (m.type === "attributes") handleAttrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
    schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
