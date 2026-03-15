import { useState, useEffect } from "react";
import { Download, Smartphone, Monitor, Apple, Chrome, MoreVertical, Share, PlusSquare, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/10">
            <Download className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Install Our App</h1>
          <p className="mt-2 text-primary-foreground/80">
            Get instant access from your home screen — no app store needed
          </p>

          {isInstalled ? (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-green-500/20 px-5 py-2.5 text-sm font-semibold text-green-200">
              ✅ App is already installed!
            </div>
          ) : deferredPrompt ? (
            <Button
              onClick={handleInstall}
              size="lg"
              className="mt-6 rounded-full bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold px-8"
            >
              <Download className="mr-2 h-5 w-5" /> Install Now
            </Button>
          ) : (
            <p className="mt-6 text-sm text-primary-foreground/60">
              Follow the steps below for your device
            </p>
          )}
        </div>
      </div>

      {/* Benefits */}
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h2 className="mb-4 text-lg font-bold text-foreground">Why Install?</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: "⚡", title: "Instant Loading", desc: "Opens in under 1 second" },
            { icon: "🔔", title: "Order Alerts", desc: "Real-time push notifications" },
            { icon: "📱", title: "Full Screen", desc: "No browser bars, native feel" },
            { icon: "📶", title: "Works Offline", desc: "Browse even without internet" },
          ].map((b) => (
            <div key={b.title} className="rounded-xl border border-border bg-card p-3.5">
              <span className="text-2xl">{b.icon}</span>
              <p className="mt-1 text-sm font-semibold text-foreground">{b.title}</p>
              <p className="text-xs text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* iOS Instructions */}
      <div className="mx-auto max-w-2xl px-4 pb-6">
        <div className={`rounded-2xl border-2 ${isIOS ? "border-primary bg-accent/30" : "border-border bg-card"} p-5`}>
          <div className="mb-3 flex items-center gap-2">
            <Apple className="h-5 w-5 text-foreground" />
            <h2 className="text-lg font-bold text-foreground">iPhone / iPad (Safari)</h2>
            {isIOS && <span className="ml-auto rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">YOUR DEVICE</span>}
          </div>
          <ol className="space-y-3">
            {[
              { step: 1, icon: <Share className="h-4 w-4" />, text: "Tap the Share button at the bottom of Safari" },
              { step: 2, icon: <ArrowUp className="h-4 w-4" />, text: "Scroll down in the share menu" },
              { step: 3, icon: <PlusSquare className="h-4 w-4" />, text: 'Tap "Add to Home Screen"' },
              { step: 4, icon: <Download className="h-4 w-4" />, text: 'Tap "Add" to confirm' },
            ].map((s) => (
              <li key={s.step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {s.step}
                </span>
                <div className="flex items-center gap-2 pt-0.5">
                  {s.icon}
                  <span className="text-sm text-foreground">{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Android Instructions */}
      <div className="mx-auto max-w-2xl px-4 pb-6">
        <div className={`rounded-2xl border-2 ${isAndroid ? "border-primary bg-accent/30" : "border-border bg-card"} p-5`}>
          <div className="mb-3 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-foreground" />
            <h2 className="text-lg font-bold text-foreground">Android (Chrome)</h2>
            {isAndroid && <span className="ml-auto rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">YOUR DEVICE</span>}
          </div>
          <ol className="space-y-3">
            {[
              { step: 1, icon: <MoreVertical className="h-4 w-4" />, text: "Tap the three-dot menu (⋮) in Chrome" },
              { step: 2, icon: <PlusSquare className="h-4 w-4" />, text: 'Tap "Add to Home screen" or "Install app"' },
              { step: 3, icon: <Download className="h-4 w-4" />, text: 'Tap "Install" to confirm' },
            ].map((s) => (
              <li key={s.step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {s.step}
                </span>
                <div className="flex items-center gap-2 pt-0.5">
                  {s.icon}
                  <span className="text-sm text-foreground">{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Desktop Instructions */}
      <div className="mx-auto max-w-2xl px-4 pb-10">
        <div className={`rounded-2xl border-2 ${!isIOS && !isAndroid ? "border-primary bg-accent/30" : "border-border bg-card"} p-5`}>
          <div className="mb-3 flex items-center gap-2">
            <Monitor className="h-5 w-5 text-foreground" />
            <h2 className="text-lg font-bold text-foreground">Desktop (Chrome / Edge)</h2>
            {!isIOS && !isAndroid && <span className="ml-auto rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold text-primary-foreground">YOUR DEVICE</span>}
          </div>
          <ol className="space-y-3">
            {[
              { step: 1, icon: <Chrome className="h-4 w-4" />, text: "Look for the install icon (⊕) in the address bar" },
              { step: 2, icon: <Download className="h-4 w-4" />, text: 'Click "Install" in the popup' },
            ].map((s) => (
              <li key={s.step} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {s.step}
                </span>
                <div className="flex items-center gap-2 pt-0.5">
                  {s.icon}
                  <span className="text-sm text-foreground">{s.text}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
