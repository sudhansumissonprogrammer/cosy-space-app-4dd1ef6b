import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { GripVertical, Headphones, Loader2, Minus, Pause, Play, RotateCcw, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { afterStorefrontOpening } from "@/lib/storefrontOpeningReady";
import { getVoiceCheckout, subscribeVoiceCheckout, hindiVoiceScripts, voiceCheckoutClip, voiceRouteClip, voiceStoreClip, type HindiVoiceClip } from "@/lib/hindiShoppingVoice";
import home from "@/assets/shopping-voice/home.mp3.asset.json";
import category from "@/assets/shopping-voice/category.mp3.asset.json";
import homeSerdiya from "@/assets/shopping-voice/home_serdiya.mp3.asset.json";
import categorySerdiya from "@/assets/shopping-voice/category_serdiya.mp3.asset.json";
import product from "@/assets/shopping-voice/product.mp3.asset.json";
import cart from "@/assets/shopping-voice/cart.mp3.asset.json";
import phone from "@/assets/shopping-voice/phone.mp3.asset.json";
import address from "@/assets/shopping-voice/address.mp3.asset.json";
import address100 from "@/assets/shopping-voice/address100.mp3.asset.json";
import name from "@/assets/shopping-voice/name.mp3.asset.json";
import postal from "@/assets/shopping-voice/postal.mp3.asset.json";
import street from "@/assets/shopping-voice/street.mp3.asset.json";
import partial100 from "@/assets/shopping-voice/partial100.mp3.asset.json";
import partial from "@/assets/shopping-voice/partial.mp3.asset.json";
import full from "@/assets/shopping-voice/full.mp3.asset.json";
import cod from "@/assets/shopping-voice/cod.mp3.asset.json";
import waiting from "@/assets/shopping-voice/waiting.mp3.asset.json";
import failed from "@/assets/shopping-voice/failed.mp3.asset.json";
import success from "@/assets/shopping-voice/success.mp3.asset.json";

const clips = { home, homeSerdiya, category, categorySerdiya, product, cart, phone, address, address100, name, postal, street, partial100, partial, full, cod, waiting, failed, success };

const POS_KEY = "sf_hindi_voice_pos";
const STATE_KEY = "sf_hindi_voice_state";
type PanelState = "open" | "bubble" | "closed";
function readStored<T>(key: string, storage: () => Storage, fallback: T): T {
  try { const v = storage().getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function writeStored(key: string, storage: () => Storage, value: unknown) {
  try { storage().setItem(key, JSON.stringify(value)); } catch { /* storage blocked */ }
}
function clampPos(p: { x: number; y: number }, w: number, h: number) {
  return { x: Math.min(Math.max(4, p.x), Math.max(4, window.innerWidth - w - 4)), y: Math.min(Math.max(4, p.y), Math.max(4, window.innerHeight - h - 4)) };
}

export default function HindiShoppingVoice({ storeId, storeSlug }: { storeId: string; storeSlug: string }) {
  const { pathname } = useLocation();
  const checkout = useSyncExternalStore(subscribeVoiceCheckout, getVoiceCheckout);
  const inCheckout = /\/checkout\/?$/.test(pathname);
  const currentCheckout = inCheckout && checkout?.storeId === storeId ? checkout : null;
  const pageClip = currentCheckout ? voiceCheckoutClip(currentCheckout) : inCheckout ? null : voiceStoreClip(voiceRouteClip(pathname, storeSlug), storeId);
  const [fieldClip, setFieldClip] = useState<HindiVoiceClip | null>(null);
  const clip = fieldClip || pageClip;
  // Speaks automatically by default; a shopper who closes or stops it stays silent for the visit.
  const [enabled, setEnabled] = useState(() => readStored(STATE_KEY, () => sessionStorage, "open" as PanelState) !== "closed");
  const [panel, setPanel] = useState<PanelState>(() => readStored(STATE_KEY, () => sessionStorage, "open" as PanelState));
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [waitingTap, setWaitingTap] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => readStored(POS_KEY, () => localStorage, null));
  const boxRef = useRef<HTMLElement | null>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean; id: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seen = useRef(new Set<string>());
  const generation = useRef(0);
  // Each guidance clip speaks only once per visit: the first category page speaks,
  // later category pages stay silent so shoppers are not irritated on every page.
  // Category guides speak again on each different category page; product and other guides speak once.
  const activeKey = `${clip}:${currentCheckout?.amount ?? ""}${clip === "category" || clip === "categorySerdiya" ? `:${pathname}` : ""}`;
  const stop = useCallback(() => {
    generation.current++;
    audioRef.current?.pause();
    setPlaying(false);
    setLoading(false);
  }, []);
  const changePanel = useCallback((next: PanelState) => { setPanel(next); writeStored(STATE_KEY, () => sessionStorage, next); }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setLoading(false); };
    audio.onerror = () => { setPlaying(false); setLoading(false); setError(true); };
    return () => { audio.pause(); audio.removeAttribute("src"); audio.load(); audioRef.current = null; };
  }, []);

  const play = useCallback((fromGesture = false) => {
    const audio = audioRef.current;
    if (!clip || !audio || document.hidden) return;
    // Do not speak over a shopper's playing shop/product video.
    if (Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio")).some(media => media !== audio && !media.paused && !media.muted && media.volume > 0)) return;
    const id = ++generation.current;
    audio.pause();
    audio.src = clips[clip].url;
    audio.currentTime = 0;
    setLoading(true);
    setError(false);
    void audio.play().then(() => {
      if (generation.current !== id) { audio.pause(); return; }
      seen.current.add(activeKey);
      setWaitingTap(false);
      setLoading(false);
      setPlaying(true);
    }).catch((err: unknown) => {
      if (generation.current !== id) return;
      setLoading(false);
      setPlaying(false);
      // Browsers block sound until the shopper's first touch; speak on that touch instead.
      if (!fromGesture && err instanceof DOMException && err.name === "NotAllowedError") setWaitingTap(true);
      else setError(true);
    });
  }, [clip, activeKey]);

  useEffect(() => {
    stop(); setFieldClip(null); setReady(false); setExpanded(false);
    return afterStorefrontOpening(() => setReady(true), 800);
  }, [pathname, stop]);
  useEffect(() => { setFieldClip(null); }, [pageClip]);
  useEffect(() => {
    stop();
    if (!ready || !enabled || !clip || seen.current.has(activeKey)) return;
    const timer = window.setTimeout(() => play(false), 350);
    return () => { window.clearTimeout(timer); stop(); };
  }, [ready, enabled, clip, activeKey, play, stop]);

  // First touch/key anywhere on the page unlocks sound and starts the pending guidance.
  useEffect(() => {
    if (!waitingTap || !enabled) return;
    const unlock = (event: Event) => {
      if (boxRef.current?.contains(event.target as Node)) return;
      play(true);
    };
    const opts = { capture: true, once: true } as const;
    document.addEventListener("pointerup", unlock, opts);
    document.addEventListener("keydown", unlock, opts);
    return () => { document.removeEventListener("pointerup", unlock, opts); document.removeEventListener("keydown", unlock, opts); };
  }, [waitingTap, enabled, play]);

  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      if (!inCheckout || !(event.target instanceof HTMLElement)) return;
      const field = event.target.getAttribute("name") || "";
      const next = /tel/.test(field) ? "phone" : field === "name" ? "name" : field === "postal-code" ? "postal" : field === "address-line1" ? "street" : null;
      if (next) setFieldClip(next);
    };
    const onVisibility = () => { if (document.hidden) stop(); };
    const onOtherMedia = (event: Event) => {
      if (event.target instanceof HTMLMediaElement && event.target !== audioRef.current && !event.target.muted && event.target.volume > 0) stop();
    };
    const onResize = () => setPos(p => p && boxRef.current ? clampPos(p, boxRef.current.offsetWidth, boxRef.current.offsetHeight) : p);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("play", onOtherMedia, true);
    document.addEventListener("volumechange", onOtherMedia, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("play", onOtherMedia, true);
      document.removeEventListener("volumechange", onOtherMedia, true);
      window.removeEventListener("resize", onResize);
    };
  }, [inCheckout, stop]);

  const onDragStart = (event: React.PointerEvent) => {
    const box = boxRef.current; if (!box) return;
    const rect = box.getBoundingClientRect();
    drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top, moved: false, id: event.pointerId };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onDragMove = (event: React.PointerEvent) => {
    const d = drag.current, box = boxRef.current; if (!d || !box || d.id !== event.pointerId) return;
    const next = clampPos({ x: event.clientX - d.dx, y: event.clientY - d.dy }, box.offsetWidth, box.offsetHeight);
    const rect = box.getBoundingClientRect();
    if (Math.abs(next.x - rect.left) + Math.abs(next.y - rect.top) > 3) d.moved = true;
    if (d.moved) setPos(next);
  };
  const onDragEnd = (event: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    if (!d) return;
    if (d.moved) { const box = boxRef.current; if (box) { const r = box.getBoundingClientRect(); writeStored(POS_KEY, () => localStorage, { x: r.left, y: r.top }); } }
    else if (panel === "bubble" && event.type === "pointerup") { changePanel("open"); setEnabled(true); play(true); }
  };
  const dragProps = { onPointerDown: onDragStart, onPointerMove: onDragMove, onPointerUp: onDragEnd, onPointerCancel: onDragEnd, style: { touchAction: "none" as const } };

  if (!ready || !clip || panel === "closed") return null;
  const placement = pos ? { left: pos.x, top: pos.y } : undefined;
  const busy = playing || loading;

  if (panel === "bubble") return createPortal(
    <aside ref={boxRef} lang="hi" data-hindi-voice={clip} style={placement} className={`fixed z-30 ${pos ? "" : "right-2 top-28 sm:right-4"}`}>
      <button type="button" {...dragProps} aria-label="हिंदी सहायक खोलें" title="हिंदी सहायक खोलें (खींचकर कहीं भी रखें)" className="relative flex h-9 w-9 cursor-grab items-center justify-center rounded-full border border-border bg-primary text-primary-foreground shadow-md active:cursor-grabbing">
        <Headphones className="h-4 w-4" />
        {busy && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-background bg-accent" />}
      </button>
    </aside>, document.body,
  );

  return createPortal(
    <aside ref={boxRef} lang="hi" data-hindi-voice={clip} style={placement} className={`fixed z-30 w-[57px] overflow-visible rounded-lg border border-border bg-background/95 text-foreground shadow-md backdrop-blur ${pos ? "" : "right-2 top-28 sm:right-4"}`}>
      <div className="flex items-center justify-between rounded-t-lg bg-primary text-primary-foreground">
        <span {...dragProps} aria-label="खींचकर जगह बदलें" title="खींचकर जगह बदलें" className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center active:cursor-grabbing">
          <GripVertical className="h-3 w-3" />
        </span>
        <Button variant="ghost" size="icon" aria-label="छोटा करें" title="छोटा करें" onClick={() => { changePanel("bubble"); setExpanded(false); }} className="h-6 w-5 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"><Minus className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" aria-label="पूरी तरह हटाएँ" title="पूरी तरह हटाएँ" onClick={() => { setEnabled(false); stop(); changePanel("closed"); }} className="h-6 w-5 shrink-0 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"><X className="h-3 w-3" /></Button>
      </div>
      <div className="flex flex-col items-center py-1">
        <Button size="icon" className="h-7 w-7 shrink-0 rounded-full" title={busy ? "आवाज़ रोकें" : "हिंदी में सुनें"} aria-label={busy ? "आवाज़ रोकें" : "हिंदी में सुनें"} onClick={() => {
          if (busy) { setEnabled(false); stop(); } else { setEnabled(true); play(true); }
        }}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        </Button>
        <div className="sr-only" aria-live="polite">
          <p className="truncate text-[10px] font-medium leading-3">{playing ? "सुन रहे हैं…" : waitingTap ? "छूते ही आवाज़ शुरू" : error ? "आवाज़ के लिए दबाइए" : "हिंदी में सुनें"}</p>
          {playing && <div className="mt-0.5 flex h-1.5 items-end gap-0.5" aria-hidden>{[0, 1, 2, 3, 4].map(i => <span key={i} className="w-0.5 animate-pulse rounded-sm bg-primary" style={{ height: `${40 + ((i * 37) % 60)}%`, animationDelay: `${i * 120}ms` }} />)}</div>}
        </div>
        <div className="flex items-center">
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="फिर से सुनें" title="फिर से सुनें" onClick={() => { setEnabled(true); play(true); }}><RotateCcw className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="हिंदी निर्देश पढ़ें" title="हिंदी निर्देश पढ़ें" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>{expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}</Button>
        </div>
      </div>
      {expanded && <div className="absolute right-0 top-full mt-1 max-h-[35vh] w-[min(190px,calc(100vw-16px))] overflow-y-auto rounded-lg border border-border bg-background px-2 py-1.5 shadow-md">
        {currentCheckout?.stage === "payment" && currentCheckout.mode === "partial" && <p className="mb-1 text-xs font-semibold">अभी ₹{currentCheckout.amount} · डिलीवरी पर ₹{currentCheckout.balance}</p>}
        <p className="text-xs leading-5">{hindiVoiceScripts[clip]}</p>
      </div>}
    </aside>, document.body,
  );
}
