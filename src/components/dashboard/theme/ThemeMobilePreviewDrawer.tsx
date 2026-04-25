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
 * PERF: Iframe is pre-mounted (hidden off-screen) on first user interaction
 * intent — we mount it as soon as the page loads in the background so by the
 * time the user taps "Preview" it is already loaded. This avoids the 3-5s
 * cold-load delay seen previously.
 */
export default function ThemeMobilePreviewDrawer({ storeSlug, iframeKey, onIframeReady, registerIframe }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  // Pre-mount on idle so the iframe loads in the background before first open.
  const [mounted, setMounted] = useState(false);
  const mobileRef = useRef<HTMLIFrameElement>(null);
  const desktopRef = useRef<HTMLIFrameElement>(null);

  // Pre-mount after the page settles (idle) so the storefront loads in the
  // background. By the time the user taps Preview, it's already painted.
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
    registerIframe(active);
    return () => registerIframe(null);
  }, [open, mode, mounted, registerIframe]);

  // Pre-mounted iframes — rendered off-screen until drawer is open, then moved
  // into place. This avoids the unmount/remount cold-load on every open.
  const iframes = mounted && (
    <>
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
    </>
  );

  return (
    <>
      {/* Hidden pre-mount stage — iframes load in background before first open */}
      {!open && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: 1,
            height: 1,
            overflow: "hidden",
            opacity: 0,
            pointerEvents: "none",
            zIndex: -1,
          }}
        >
          {iframes}
        </div>
      )}

      {/* Floating Preview FAB — only on mobile/tablet (lg hides it because desktop has split-screen) */}
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

          {/* Iframe stage — show/hide via CSS so iframes never unmount */}
          <div className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center py-3">
            {!mounted && (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <div className="h-8 w-8 rounded-full border-2 border-foreground/20 border-t-foreground animate-spin" />
                <p className="text-xs">Loading preview…</p>
              </div>
            )}
            <div style={{ display: mounted && mode === "mobile" ? "block" : "none" }}>
              <div className="rounded-[2rem] border-[5px] border-gray-900 bg-gray-900 shadow-xl overflow-hidden">
                <div style={{ width: "320px", height: "640px", overflow: "hidden" }}>
                  {mounted && mode === "mobile" && mobileRef.current}
                </div>
              </div>
            </div>
            <div style={{ display: mounted && mode === "desktop" ? "block" : "none" }} className="w-full px-2">
              <div className="rounded-lg border border-border bg-background shadow-lg overflow-hidden mx-auto w-full max-w-3xl">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/40 border-b border-border">
                  <div className="h-2 w-2 rounded-full bg-destructive/50" />
                  <div className="h-2 w-2 rounded-full bg-warning/50" />
                  <div className="h-2 w-2 rounded-full bg-success/50" />
                </div>
                <div style={{ width: "100%", height: "560px", overflow: "hidden" }}>
                  {mounted && mode === "desktop" && desktopRef.current}
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
