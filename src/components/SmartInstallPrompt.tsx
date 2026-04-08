import { useState, useEffect, useCallback } from "react";
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
  const [showPopup, setShowPopup] = useState(false);
  const [showStrip, setShowStrip] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    // If currently standalone, mark as installed and don't show prompts
    if (isStandalone) {
      localStorage.setItem(WAS_INSTALLED_KEY, "true");
      return;
    }

    // Detect uninstall: was installed before but now running in browser
    const wasInstalled = localStorage.getItem(WAS_INSTALLED_KEY);
    if (wasInstalled === "true") {
      // User uninstalled — clear all dismiss keys so prompts re-appear
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

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);

      const popupDismissed = localStorage.getItem(POPUP_DISMISSED_KEY);
      const wasRecentlyDismissed = popupDismissed && Date.now() - Number(popupDismissed) < 24 * 60 * 60 * 1000;

      if (wasRecentlyDismissed) {
        setShowStrip(true);
      } else {
        setTimeout(() => setShowPopup(true), delay);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [delay]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowPopup(false);
      setShowStrip(false);
      localStorage.setItem(WAS_INSTALLED_KEY, "true");
    }
    setDeferredPrompt(null);
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
            {(appName.toLowerCase().includes("shopbanao")
              ? [
                  { emoji: "⚡", text: "Manage orders on the go" },
                  { emoji: "🔔", text: "Instant order notifications" },
                  { emoji: "📱", text: "Full-screen app experience" },
                ]
              : [
                  { emoji: "⚡", text: "Lightning fast loading" },
                  { emoji: "🔔", text: "Instant order notifications" },
                  { emoji: "📱", text: "Full-screen native experience" },
                ]
            ).map((b) => (
              <div key={b.text} className="flex items-center gap-2.5">
                <span className="text-base">{b.emoji}</span>
                <span className="text-sm text-foreground">{b.text}</span>
              </div>
            ))}
          </div>

          <div className="px-5 pb-5 flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={handleDismissPopup}>
              Not Now
            </Button>
            <Button
              className="flex-1 font-bold"
              style={{ backgroundColor: primaryColor, color: textColor }}
              onClick={handleInstall}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Install
            </Button>
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
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-opacity hover:opacity-90"
          style={{ backgroundColor: `${textColor}`, color: primaryColor }}
        >
          INSTALL
        </button>
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
