import { useState, useEffect, useCallback } from "react";
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
  const [showPopup, setShowPopup] = useState(false);
  const [showStrip, setShowStrip] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (isStandalone) {
      localStorage.setItem(WAS_INSTALLED_KEY, "true");
      return;
    }

    // Detect uninstall
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
      localStorage.setItem(WAS_INSTALLED_KEY, "true");
    };
    window.addEventListener("appinstalled", onInstalled);

    // Check if strip was dismissed within 3 days
    const stripDismissed = localStorage.getItem(STRIP_DISMISSED_KEY);
    if (stripDismissed && Date.now() - Number(stripDismissed) < 3 * 24 * 60 * 60 * 1000) {
      window.removeEventListener("appinstalled", onInstalled);
      return;
    }

    const popupDismissed = localStorage.getItem(POPUP_DISMISSED_KEY);
    const wasRecentlyDismissed = popupDismissed && Date.now() - Number(popupDismissed) < 24 * 60 * 60 * 1000;

    // Detect iOS
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isiOS);

    // For iOS: no beforeinstallprompt, show manual instructions after delay
    if (isiOS) {
      if (wasRecentlyDismissed) {
        setShowStrip(true);
      } else {
        setTimeout(() => setShowPopup(true), delay);
      }
      return () => {
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    // For Chrome/Android: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      if (wasRecentlyDismissed) {
        setShowStrip(true);
      } else {
        setTimeout(() => setShowPopup(true), delay);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Fallback: if no beforeinstallprompt after delay+3s, show anyway on mobile
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && !isiOS) {
      fallbackTimer = setTimeout(() => {
        if (!deferredPrompt) {
          if (wasRecentlyDismissed) {
            setShowStrip(true);
          } else {
            setShowPopup(true);
          }
        }
      }, delay + 3000);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [delay]);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setShowPopup(false);
        setShowStrip(false);
        localStorage.setItem(WAS_INSTALLED_KEY, "true");
      }
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

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
          {isIOS && !deferredPrompt && (
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

          <div className="px-5 pb-5 flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={handleDismissPopup}>
              Not Now
            </Button>
            {deferredPrompt ? (
              <Button
                className="flex-1 font-bold"
                style={{ backgroundColor: primaryColor, color: textColor }}
                onClick={handleInstall}
              >
                <Download className="mr-1.5 h-4 w-4" />
                Install
              </Button>
            ) : isIOS ? (
              <Button
                className="flex-1 font-bold"
                style={{ backgroundColor: primaryColor, color: textColor }}
                onClick={handleDismissPopup}
              >
                Got it
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Strip under header
  if (showStrip) {
    return (
      <div
        className="sticky top-12 z-[55] flex items-center gap-2 px-3 py-1.5 border-b border-border"
        style={{ backgroundColor: primaryColor, color: textColor }}
      >
        <Download className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <p className="flex-1 text-xs font-medium truncate">
          Install {appName} app for the best experience
        </p>
        {deferredPrompt ? (
          <button
            onClick={handleInstall}
            className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: `${textColor}`, color: primaryColor }}
          >
            INSTALL
          </button>
        ) : isIOS ? (
          <button
            onClick={() => { setShowStrip(false); setShowPopup(true); }}
            className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-opacity hover:opacity-90"
            style={{ backgroundColor: `${textColor}`, color: primaryColor }}
          >
            HOW TO
          </button>
        ) : null}
        <button
          onClick={handleDismissStrip}
          className="shrink-0 p-0.5 opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
