import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Headphones, Loader2, Pause, Play, RotateCcw, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { afterStorefrontOpening } from "@/lib/storefrontOpeningReady";
import { getVoiceCheckout, subscribeVoiceCheckout, hindiVoiceScripts, voicePaymentClip, voiceRouteClip, type HindiVoiceClip } from "@/lib/hindiShoppingVoice";
import home from "@/assets/shopping-voice/home.mp3.asset.json";
import category from "@/assets/shopping-voice/category.mp3.asset.json";
import product from "@/assets/shopping-voice/product.mp3.asset.json";
import cart from "@/assets/shopping-voice/cart.mp3.asset.json";
import phone from "@/assets/shopping-voice/phone.mp3.asset.json";
import address from "@/assets/shopping-voice/address.mp3.asset.json";
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

const clips = { home, category, product, cart, phone, address, name, postal, street, partial100, partial, full, cod, waiting, failed, success };

export default function HindiShoppingVoice({ storeId, storeSlug }: { storeId: string; storeSlug: string }) {
  const { pathname } = useLocation();
  const checkout = useSyncExternalStore(subscribeVoiceCheckout, getVoiceCheckout);
  const inCheckout = /\/checkout\/?$/.test(pathname);
  const currentCheckout = inCheckout && checkout?.storeId === storeId ? checkout : null;
  const pageClip = currentCheckout ? currentCheckout.stage === "loading" ? null : currentCheckout.stage === "payment" ? voicePaymentClip(currentCheckout) : currentCheckout.stage : inCheckout ? null : voiceRouteClip(pathname, storeSlug);
  const [fieldClip, setFieldClip] = useState<HindiVoiceClip | null>(null);
  const clip = fieldClip || pageClip;
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seen = useRef(new Set<string>());
  const generation = useRef(0);
  const activeKey = `${pathname}:${clip}:${currentCheckout?.amount ?? ""}`;
  const stop = useCallback(() => {
    generation.current++;
    audioRef.current?.pause();
    setPlaying(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";
    audioRef.current = audio;
    audio.onended = () => { setPlaying(false); setLoading(false); };
    audio.onerror = () => { setPlaying(false); setLoading(false); setError(true); };
    return () => { audio.pause(); audio.removeAttribute("src"); audio.load(); audioRef.current = null; };
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!clip || !audio || document.hidden) return;
    // Do not speak over a shopper's playing shop/product video.
    if (Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio")).some(media => !media.paused && !media.muted && media.volume > 0)) return;
    const id = ++generation.current;
    audio.pause();
    audio.src = clips[clip].url;
    audio.currentTime = 0;
    setLoading(true);
    setError(false);
    void audio.play().then(() => {
      if (generation.current !== id) { audio.pause(); return; }
      seen.current.add(activeKey);
      setLoading(false);
      setPlaying(true);
    }).catch(() => {
      if (generation.current !== id) return;
      setLoading(false);
      setPlaying(false);
      setError(true);
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
    const timer = window.setTimeout(play, 350);
    return () => { window.clearTimeout(timer); stop(); };
  }, [ready, enabled, clip, activeKey, play, stop]);

  useEffect(() => {
    const onFocus = (event: FocusEvent) => {
      if (!inCheckout || !(event.target instanceof HTMLElement)) return;
      const field = event.target.getAttribute("name") || "";
      const next = /tel/.test(field) ? "phone" : field === "name" ? "name" : field === "postal-code" ? "postal" : field === "address-line1" ? "street" : null;
      if (next) setFieldClip(next);
    };
    const onVisibility = () => { if (document.hidden) stop(); };
    const onOtherMedia = (event: Event) => {
      if (event.target instanceof HTMLMediaElement && !event.target.muted && event.target.volume > 0) stop();
    };
    document.addEventListener("focusin", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("play", onOtherMedia, true);
    document.addEventListener("volumechange", onOtherMedia, true);
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("play", onOtherMedia, true);
      document.removeEventListener("volumechange", onOtherMedia, true);
    };
  }, [inCheckout, stop]);

  if (!ready || !clip) return null;
  return createPortal(
    <aside lang="hi" data-hindi-voice={clip} className="fixed right-2 top-28 z-30 max-w-[min(280px,calc(100vw-16px))] rounded-md border border-border bg-background text-foreground shadow-md sm:right-4">
      <div className="flex items-center gap-1 p-1">
        <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-xs" aria-label={playing || loading ? "आवाज़ बंद करें" : "हिंदी में सुनें"} title={playing || loading ? "आवाज़ बंद करें" : "हिंदी में सुनें"} onClick={() => {
          if (playing || loading) { setEnabled(false); stop(); }
          else { setEnabled(true); play(); }
        }}>
          {loading ? <Loader2 className="animate-spin" /> : playing ? <Pause /> : <Headphones />}
          {playing ? "सुन रहे हैं" : "हिंदी में सुनें"}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="हिंदी निर्देश पढ़ें" title="हिंदी निर्देश पढ़ें" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}><ChevronDown /></Button>
      </div>
      {expanded && <div className="max-h-[35vh] overflow-y-auto border-t border-border px-3 py-2">
        {currentCheckout?.stage === "payment" && currentCheckout.mode === "partial" && <p className="mb-2 text-sm font-semibold">अभी ₹{currentCheckout.amount} · डिलीवरी पर ₹{currentCheckout.balance}</p>}
        <p className="text-sm leading-6">{hindiVoiceScripts[clip]}</p>
        {error && <p className="mt-2 text-xs text-muted-foreground">आवाज़ सुनने के लिए फिर से दबाइए।</p>}
        <div className="mt-2 flex justify-end gap-1">
          <Button variant="ghost" size="icon" aria-label="फिर से सुनें" title="फिर से सुनें" onClick={() => { setEnabled(true); play(); }}><RotateCcw /></Button>
          <Button variant="ghost" size="icon" aria-label="आवाज़ बंद करके निर्देश समेटें" title="बंद करें" onClick={() => { setEnabled(false); stop(); setExpanded(false); }}><X /></Button>
        </div>
      </div>}
    </aside>, document.body,
  );
}