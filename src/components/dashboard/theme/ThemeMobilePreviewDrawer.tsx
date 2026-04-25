import { useState, useRef, useEffect } from "react";
import { Eye, X, Smartphone, Monitor } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface Props {
  storeSlug: string;
  iframeKey: number;
  onIframeReady: (iframe: HTMLIFrameElement | null) => void;
  /** Forwarded so updates flow to the drawer iframe too */
  registerIframe?: (iframe: HTMLIFrameElement | null) => void;
}

/**
 * Mobile sticky "Preview" button + slide-up drawer (#2 + #10).
 *
 * PERF: The iframe is mounted once on idle (in the background) and never
 * unmounted. Opening the drawer just toggles its visibility, so the preview
 * appears instantly instead of cold-loading 3-5s every time.
 */
export default function ThemeMobilePreviewDrawer({ storeSlug, iframeKey, onIframeReady, registerIframe }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  const [mounted, setMounted] = useState(false);
  const mobileRef = useRef<HTMLIFrameElement>(null);
  const desktopRef = useRef<HTMLIFrameElement>(null);

  // Pre-mount once the page is idle so the storefront loads in the background
  // before the user even opens the drawer.
  useEffect(() => {
    if (mounted) return;
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    let id: number;
    if (ric) {
      id = ric(() => setMounted(true), { timeout: 2500 });
    } else {
      id = window.setTimeout(() => setMounted(true), 1500) as unknown as number;
    }
    return () => {
      if (ric && (window as any).cancelIdleCallback) {
        (window as any).cancelIdleCallback(id);
      } else {
        clearTimeout(id);
      }
    };
  }, [mounted]);

  // Always keep the active iframe registered so live theme updates flow in.
  useEffect(() => {
    if (!registerIframe) return;
    const active = mode === "mobile" ? mobileRef.current : desktopRef.current;
    if (active) registerIframe(active);
    return () => registerIframe(null);
  }, [mode, mounted, registerIframe]);

  // Wrapper position: while drawer is closed → off-screen tiny; when open →
  // fixed-positioned over the drawer body. Using inline styles + visibility so
  // iframes never unmount (preserves loaded storefront state).
  const stageStyle: React.CSSProperties = open
    ? {
        position: "fixed",
        left: "50%",
        top: "calc(50% + 30px)",
        transform: "translate(-50%, -50%)",
        zIndex: 60,
        pointerEvents: "auto",
      }
    : {
        position: "fixed",
        top: 0,
        left: 0,
        width: 1,
        height: 1,
        overflow: "hidden",
        opacity: 0,
        pointerEvents: "none",
        zIndex: -1,
      };

  return (
    <>
      {/* Persistent iframe stage — never unmounts so re-opens are instant */}
      {mounted && (
        <div style={stageStyle} aria-hidden={!open}>
          {/* Mobile frame */}
          <div style={{ display: mode === "mobile" ? "block" : "none" }}>
            <div className="rounded-[2rem] border-[5px] border-gray-900 bg-gray-900 shadow-xl overflow-hidden">
              <div style={{ width: "320px", height: "640px", overflow: "hidden" }}>
                <iframe
                  key={`drawer-mobile-${iframeKey}`}
                  ref={mobileRef}
                  src={`/store/${storeSlug}?preview=1`}
                  title="Mobile Preview"
                  loading="eager"
                  onLoad={() => onIframeReady(mobileRef.current)}
                  style={{
                    width: "375px",
                    height: "750px",
                    border: "none",
                    transform: "scale(0.853)",
                    transformOrigin: "top left",
                  }}
                />
              </div>
            </div>
          </div>
          {/* Desktop frame */}
          <div style={{ display: mode === "desktop" ? "block" : "none" }}>
            <div className="rounded-lg border border-border bg-background shadow-lg overflow-hidden w-[min(92vw,720px)]">
              <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/40 border-b border-border">
                <div className="h-2 w-2 rounded-full bg-destructive/50" />
                <div className="h-2 w-2 rounded-full bg-warning/50" />
                <div className="h-2 w-2 rounded-full bg-success/50" />
              </div>
              <div style={{ width: "100%", height: "min(60vh, 560px)", overflow: "hidden" }}>
                <iframe
                  key={`drawer-desktop-${iframeKey}`}
                  ref={desktopRef}
                  src={`/store/${storeSlug}?preview=1`}
                  title="Desktop Preview"
                  loading="eager"
                  onLoad={() => onIframeReady(desktopRef.current)}
                  style={{
                    width: "1440px",
                    height: "900px",
                    border: "none",
                    transform: "scale(0.5)",
                    transformOrigin: "top left",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Preview FAB — only on mobile/tablet (lg has split-screen) */}
      <button
        onClick={() => setOpen(true)}
        onPointerDown={() => !mounted && setMounted(true)}
        className="lg:hidden fixed z-30 right-4 flex items-center gap-2 rounded-full bg-foreground px-4 py-3 text-sm font-bold text-background shadow-2xl ring-1 ring-foreground/10 active:scale-95 transition-transform"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0) + 84px)" }}
        aria-label="Open live preview"
      >
        <Eye className="h-4 w-4" />
        Preview
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="h-[88vh] p-0 rounded-t-2xl border-t-2 flex flex-col"
        >
          <SheetTitle className="sr-only">Live Storefront Preview</SheetTitle>
          {/* Header with mode switcher */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-0.5">
              <button
                onClick={() => setMode("mobile")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  mode === "mobile" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                Mobile
              </button>
              <button
                onClick={() => setMode("desktop")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  mode === "desktop" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                Desktop
              </button>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Spacer — the actual iframe is positioned over this area via the
              persistent stage (see top of component). This avoids unmounting
              the iframe when the drawer closes. */}
          <div className="flex-1 overflow-hidden bg-muted/30 flex items-center justify-center">
            {!mounted && (
              <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="h-8 w-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                <p className="text-xs">Loading preview…</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
