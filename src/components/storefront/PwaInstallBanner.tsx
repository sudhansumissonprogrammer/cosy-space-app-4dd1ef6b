import { useState, useEffect } from "react";
import { X, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

export default function PwaInstallBanner({ storeName }: { storeName: string }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Don't show if already installed or dismissed recently
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setShow(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  if (!show) return null;

  return (
    <div className="sticky top-14 z-20 px-3 py-2" style={{ backgroundColor: "var(--storefront-bg, hsl(var(--card)))", borderBottom: "1px solid color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 10%, transparent)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--storefront-primary, hsl(var(--primary)))" }}>
          <Download className="h-4 w-4" style={{ color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate" style={{ color: "var(--storefront-text, hsl(var(--foreground)))" }}>
            Install {storeName}
          </p>
          <p className="text-[10px] leading-tight" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 55%, transparent)" }}>
            Add to home screen for quick access
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors"
          style={{
            backgroundColor: "var(--storefront-primary, hsl(var(--primary)))",
            color: "var(--storefront-btn-text, hsl(var(--primary-foreground)))",
          }}
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1 transition-colors" style={{ color: "color-mix(in srgb, var(--storefront-text, hsl(var(--foreground))) 50%, transparent)" }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
