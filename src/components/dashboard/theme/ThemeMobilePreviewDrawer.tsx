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
 * Always available on mobile/tablet so the user can check changes
 * without scrolling 1500px down.
 */
export default function ThemeMobilePreviewDrawer({ storeSlug, iframeKey, onIframeReady, registerIframe }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (open && registerIframe) registerIframe(iframeRef.current);
    return () => {
      if (registerIframe) registerIframe(null);
    };
  }, [open, registerIframe]);

  return (
    <>
      {/* Floating Preview FAB — only on mobile/tablet (lg hides it because desktop has split-screen) */}
      <button
        onClick={() => setOpen(true)}
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

          {/* Iframe stage */}
          <div className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center py-3">
            {mode === "mobile" ? (
              <div className="rounded-[2rem] border-[5px] border-gray-900 bg-gray-900 shadow-xl overflow-hidden">
                <div style={{ width: "320px", height: "640px", overflow: "hidden" }}>
                  <iframe
                    key={`drawer-mobile-${iframeKey}`}
                    ref={iframeRef}
                    src={`/store/${storeSlug}?preview=1`}
                    title="Mobile Preview"
                    onLoad={() => onIframeReady(iframeRef.current)}
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
            ) : (
              <div className="rounded-lg border border-border bg-background shadow-lg overflow-hidden mx-2 w-full max-w-3xl">
                <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/40 border-b border-border">
                  <div className="h-2 w-2 rounded-full bg-destructive/50" />
                  <div className="h-2 w-2 rounded-full bg-warning/50" />
                  <div className="h-2 w-2 rounded-full bg-success/50" />
                </div>
                <div style={{ width: "100%", height: "560px", overflow: "hidden" }}>
                  <iframe
                    key={`drawer-desktop-${iframeKey}`}
                    ref={iframeRef}
                    src={`/store/${storeSlug}?preview=1`}
                    title="Desktop Preview"
                    onLoad={() => onIframeReady(iframeRef.current)}
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
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
