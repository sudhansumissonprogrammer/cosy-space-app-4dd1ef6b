import { useState, useEffect, useCallback, useRef } from "react";
import { X, Download, Smartphone } from "lucide-react";
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

  useEffect(() => {
    try {
      if (window.self !== window.top && window.location.hostname.includes("lovable")) return;
    } catch {
      /* cross-origin iframe, continue */
    }

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
      return () => window.removeEventListener("appinstalled", onInstalled);
    }

    const popupDismissed = localStorage.getItem(POPUP_DISMISSED_KEY);
    const wasRecentlyDismissed =
      !!popupDismissed && Date.now() - Number(popupDismissed) < 24 * 60 * 60 * 1000;

    let popupTimer: ReturnType<typeof setTimeout> | null = null;

    const handler = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setDeferredPrompt(evt);
      promptRef.current = evt;

      if (wasRecentlyDismissed) {
        setShowStrip(true);
      } else {
        popupTimer = setTimeout(() => setShowPopup(true), delay);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
      if (popupTimer) clearTimeout(popupTimer);
    };
  }, [delay]);

  const handleInstall = useCallback(async () => {
    const prompt = promptRef.current;
    if (!prompt) return;

    try {
      setShowPopup(false);
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;

      if (outcome === "accepted") {
        setShowStrip(false);
        localStorage.setItem(WAS_INSTALLED_KEY, "true");
      } else {
        setShowStrip(false);
        localStorage.setItem(POPUP_DISMISSED_KEY, String(Date.now()));
        localStorage.setItem(STRIP_DISMISSED_KEY, String(Date.now()));
      }
    } finally {
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

  if (showPopup && canNativeInstall) {
    return (
      <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 sm:items-center">
        <div className="mx-3 mb-4 w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in slide-in-from-bottom-4 duration-300 sm:mb-0">
          <div
            className="px-5 pb-5 pt-6 text-center"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
          >
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl"
              style={{ backgroundColor: logoUrl ? "transparent" : `${textColor}20` }}
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

          <div className="space-y-2.5 px-5 py-4">
            {benefits.map((b) => (
              <div key={b.text} className="flex items-center gap-2.5">
                <span className="text-base">{b.emoji}</span>
                <span className="text-sm text-foreground">{b.text}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2.5 px-5 pb-5">
            <Button variant="outline" className="flex-1" onClick={handleDismissPopup}>
              Not Now
            </Button>
            <Button
              className="flex-1 font-bold"
              style={{ backgroundColor: primaryColor, color: textColor }}
              onClick={handleInstall}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Install App
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (showStrip && canNativeInstall) {
    return (
      <div className="sticky top-14 z-[55] flex items-center gap-3 border-b border-white/10 bg-gradient-to-r from-[#1a1a2e] to-[#16213e] px-3 py-2 shadow-sm sm:top-12">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="h-9 w-9 object-contain" />
          ) : (
            <Smartphone className="h-5 w-5 text-white" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-white">
            {appName}
          </p>
          <p className="text-[10px] leading-tight text-white/60">
            Get the app for a better experience
          </p>
        </div>

        <button
          onClick={handleInstall}
          className="shrink-0 rounded-lg bg-white px-4 py-1.5 text-xs font-bold text-[#1a1a2e] transition-transform active:scale-95"
        >
          INSTALL
        </button>

        <button
          onClick={handleDismissStrip}
          className="shrink-0 p-1 opacity-50 transition-opacity hover:opacity-100"
        >
          <X className="h-3.5 w-3.5 text-white" />
        </button>
      </div>
    );
  }

  return null;
}
