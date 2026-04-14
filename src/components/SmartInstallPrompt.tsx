import { useState, useEffect, useCallback, useRef } from "react";
import { X, Download, Smartphone, Share, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const POPUP_DISMISSED_KEY = "pwa-popup-dismissed";
const STRIP_DISMISSED_KEY = "pwa-strip-dismissed";
const WAS_INSTALLED_KEY = "pwa-was-installed";

interface SmartInstallPromptProps {
  appName: string;
  primaryColor?: string;
  textColor?: string;
  delay?: number;
  logoUrl?: string;
}

export default function SmartInstallPrompt({
  appName,
  primaryColor = "hsl(var(--primary))",
  textColor = "hsl(var(--primary-foreground))",
  delay = 20000,
  logoUrl,
}: SmartInstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showStrip, setShowStrip] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    // Skip in Lovable preview iframes only
    try {
      if (window.self !== window.top && window.location.hostname.includes("lovable")) return;
    } catch { /* cross-origin iframe, continue */ }

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (isStandalone) {
      localStorage.setItem(WAS_INSTALLED_KEY, "true");
      return;
    }

    const wasInstalled = localStorage.getItem(WAS_INSTALLED_KEY);
    if (wasInstalled === "true") {
      localStorage.removeItem(POPUP_DISMISSED_KEY);
      localStorage.removeItem(STRIP_DISMISSED_KEY);
      localStorage.removeItem(WAS_INSTALLED_KEY);
    }

    const onInstalled = () => {
      setShowPopup(false);
      setShowStrip(false);
      setDeferredPrompt(null);
      promptRef.current = null;
      localStorage.setItem(WAS_INSTALLED_KEY, "true");
    };
    window.addEventListener("appinstalled", onInstalled);

    const stripDismissed = localStorage.getItem(STRIP_DISMISSED_KEY);
    if (stripDismissed && Date.now() - Number(stripDismissed) < 3 * 24 * 60 * 60 * 1000) {
      window.removeEventListener("appinstalled", onInstalled);
      return;
    }

    const popupDismissed = localStorage.getItem(POPUP_DISMISSED_KEY);
    const wasRecentlyDismissed = popupDismissed && Date.now() - Number(popupDismissed) < 24 * 60 * 60 * 1000;

    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isiOS);

    // iOS: show manual instructions
    if (isiOS) {
      if (wasRecentlyDismissed) {
        setShowStrip(true);
      } else {
        setTimeout(() => setShowPopup(true), delay);
      }
      return () => window.removeEventListener("appinstalled", onInstalled);
    }

    // Chrome/Android: listen for beforeinstallprompt
    let gotPrompt = false;
    const handler = (e: Event) => {
      e.preventDefault();
      gotPrompt = true;
      const evt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(evt);
      promptRef.current = evt;

      if (wasRecentlyDismissed) {
        setShowStrip(true);
      } else {
        setTimeout(() => setShowPopup(true), delay);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Fallback for Android: show manual guide if beforeinstallprompt doesn't fire
    const isMobileAndroid = /Android/i.test(navigator.userAgent);
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    if (isMobileAndroid) {
      fallbackTimer = setTimeout(() => {
        if (!gotPrompt) {
          setShowManualGuide(true);
          if (wasRecentlyDismissed) {
            setShowStrip(true);
          } else {
            setShowPopup(true);
          }
        }
      }, delay + 2000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [delay]);

  const handleInstall = useCallback(async () => {
    const p = promptRef.current;
    if (p) {
      p.prompt();
      const { outcome } = await p.userChoice;
      if (outcome === "accepted") {
        setShowPopup(false);
        setShowStrip(false);
        localStorage.setItem(WAS_INSTALLED_KEY, "true");
      }
      setDeferredPrompt(null);
      promptRef.current = null;
    }
  }, []);

  const handleDismissPopup = useCallback(() => {
    setShowPopup(false);
    setShowStrip(true);
    localStorage.setItem(POPUP_DISMISSED_KEY, String(Date.now()));
  }, []);

  const handleDismissStrip = useCallback(() => {
    setShowStrip(false);
    localStorage.setItem(STRIP_DISMISSED_KEY, String(Date.now()));
  }, []);

  const benefits = appName.toLowerCase().includes("shopbanao")
    ? [
        { emoji: "⚡", text: "Manage orders on the go" },
        { emoji: "🔔", text: "Instant order notifications" },
        { emoji: "📱", text: "Full-screen app experience" },
      ]
    : [
        { emoji: "⚡", text: "Lightning fast loading" },
        { emoji: "🔔", text: "Instant order notifications" },
        { emoji: "📱", text: "Full-screen native experience" },
      ];

  const canNativeInstall = !!deferredPrompt;

  // Full-screen popup overlay
  if (showPopup) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="w-full max-w-sm mx-3 mb-4 sm:mb-0 rounded-2xl bg-card shadow-2xl border border-border overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <div
            className="px-5 pt-6 pb-5 text-center"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
          >
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl overflow-hidden"
              style={{ backgroundColor: logoUrl ? 'transparent' : `${textColor}20` }}
            >
              {logoUrl ? (
                <img src={logoUrl} alt={appName} className="h-14 w-14 object-contain" />
              ) : (
                <Smartphone className="h-7 w-7" style={{ color: textColor }} />
              )}
            </div>
            <h3 className="text-xl font-bold" style={{ color: textColor }}>
              Get {appName} App
            </h3>
            <p className="mt-1 text-sm opacity-80" style={{ color: textColor }}>
              Install for a faster, app-like experience
            </p>
          </div>

          <div className="px-5 py-4 space-y-2.5">
            {benefits.map((b) => (
              <div key={b.text} className="flex items-center gap-2.5">
                <span className="text-base">{b.emoji}</span>
                <span className="text-sm text-foreground">{b.text}</span>
              </div>
            ))}
          </div>

          {/* iOS manual instructions */}
          {isIOS && !canNativeInstall && (
            <div className="px-5 pb-3 pt-1 border-t border-border">
              <p className="text-xs font-semibold text-foreground mb-2">How to install:</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Share className="h-3.5 w-3.5 shrink-0" />
                  <span>Tap the <strong className="text-foreground">Share</strong> button below</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <PlusSquare className="h-3.5 w-3.5 shrink-0" />
                  <span>Tap <strong className="text-foreground">"Add to Home Screen"</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* Android manual guide (fallback when beforeinstallprompt didn't fire) */}
          {showManualGuide && !canNativeInstall && !isIOS && (
            <div className="px-5 pb-3 pt-1 border-t border-border">
              <p className="text-xs font-semibold text-foreground mb-2">How to install:</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-foreground font-bold text-sm">⋮</span>
                  <span>Tap the <strong className="text-foreground">3-dot menu</strong> in Chrome</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span>Tap <strong className="text-foreground">"Install app"</strong> or <strong className="text-foreground">"Add to Home screen"</strong></span>
                </div>
              </div>
            </div>
          )}

          <div className="px-5 pb-5 flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={handleDismissPopup}>
              Not Now
            </Button>
            <Button
              className="flex-1 font-bold"
              style={{ backgroundColor: primaryColor, color: textColor }}
              onClick={canNativeInstall ? handleInstall : handleDismissPopup}
              disabled={!canNativeInstall && !isIOS && !showManualGuide}
            >
              <Download className="mr-1.5 h-4 w-4" />
              {canNativeInstall ? "Install App" : "Got it"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Smart app install strip — like Flipkart / Myntra style
  if (showStrip) {
    return (
      <div className="sticky top-14 sm:top-12 z-[55] flex items-center gap-3 px-3 py-2 bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border-b border-white/10 shadow-sm">
        {/* App icon */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-white/10">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-9 w-9 object-contain" />
          ) : (
            <Smartphone className="h-5 w-5 text-white" />
          )}
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-white leading-tight truncate">
            {appName}
          </p>
          <p className="text-[10px] text-white/60 leading-tight">
            Get the app for a better experience
          </p>
        </div>

        {/* Install button */}
        <button
          onClick={canNativeInstall ? handleInstall : handleDismissStrip}
          className="shrink-0 rounded-lg px-4 py-1.5 text-xs font-bold bg-white text-[#1a1a2e] active:scale-95 transition-transform"
        >
          INSTALL
        </button>

        {/* Close */}
        <button
          onClick={handleDismissStrip}
          className="shrink-0 p-1 opacity-50 hover:opacity-100 transition-opacity"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>
      </div>
    );
  }

  return null;
}
