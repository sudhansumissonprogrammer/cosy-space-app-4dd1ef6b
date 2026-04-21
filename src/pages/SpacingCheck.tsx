/**
 * SpacingCheck — internal QA preview for verifying that themes 19 & 20
 * use identical header / hero paddings and gaps across mobile, tablet and
 * desktop breakpoints.
 *
 * Renders the live storefront for the currently selected store inside
 * iframes locked to common viewport widths so spacing can be visually
 * compared side-by-side.
 *
 * Mounted at: /dashboard/stores/:storeSlug/spacing-check
 */
import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { storefrontPath } from "@/lib/subdomain";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw } from "lucide-react";

interface Breakpoint {
  label: string;
  width: number;
  height: number;
  note: string;
}

const BREAKPOINTS: Breakpoint[] = [
  { label: "Mobile", width: 390, height: 720, note: "iPhone 14 — px-4 baseline" },
  { label: "Tablet", width: 768, height: 720, note: "iPad portrait — md breakpoint" },
  { label: "Desktop", width: 1280, height: 720, note: "Standard laptop — should match mobile gaps" },
];

const THEMES = ["theme-19", "theme-20"] as const;
type ThemeKey = (typeof THEMES)[number];

export default function SpacingCheck() {
  const { storeSlug } = useParams<{ storeSlug: string }>();
  const [reloadKey, setReloadKey] = useState(0);
  const [activeThemes, setActiveThemes] = useState<ThemeKey[]>([...THEMES]);

  const previewUrl = useMemo(() => {
    if (!storeSlug) return "";
    // Use the in-app storefront route so we don't hit external DNS during QA.
    return storefrontPath(storeSlug);
  }, [storeSlug]);

  if (!storeSlug) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">No store selected.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <Link
          to={`/dashboard/stores/${storeSlug}/theme`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to theme
        </Link>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Spacing checklist</h1>
        <Badge variant="secondary">QA preview</Badge>
        <div className="ml-auto flex items-center gap-2">
          {THEMES.map((t) => {
            const active = activeThemes.includes(t);
            return (
              <Button
                key={t}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() =>
                  setActiveThemes((prev) =>
                    prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                  )
                }
              >
                {t.replace("theme-", "Theme ")}
              </Button>
            );
          })}
          <Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            <RefreshCw className="h-4 w-4 mr-1" /> Reload
          </Button>
        </div>
      </header>

      <Card className="p-4 text-sm leading-relaxed bg-muted/40">
        <p className="font-semibold mb-1">What to verify</p>
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li>Header logo, location chip and search bar share the same horizontal padding (<code>px-4</code>) at every width.</li>
          <li>Hero carousel left/right edges line up with the search bar above it (no extra desktop indent).</li>
          <li>Container max-width stays at <code>max-w-3xl</code> — desktop should look like a stretched mobile, not a wide site.</li>
          <li>Vertical gap between header and hero is identical across mobile / tablet / desktop.</li>
        </ul>
      </Card>

      {activeThemes.map((theme) => (
        <section key={theme} className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">{theme.replace("theme-", "Theme ")}</h2>
            <span className="text-xs text-muted-foreground">
              Live preview · /{storeSlug}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {BREAKPOINTS.map((bp) => (
              <div key={bp.label} className="space-y-2">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold">{bp.label}</span>
                  <span className="text-muted-foreground">{bp.width}×{bp.height}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{bp.note}</p>
                <div
                  className="rounded-lg border border-border bg-background overflow-hidden mx-auto"
                  style={{ width: "100%", maxWidth: bp.width }}
                >
                  <iframe
                    key={`${theme}-${bp.label}-${reloadKey}`}
                    src={`${previewUrl}?__qa_theme=${theme}`}
                    title={`${theme} ${bp.label} preview`}
                    width={bp.width}
                    height={bp.height}
                    style={{
                      width: "100%",
                      height: bp.height,
                      border: 0,
                      display: "block",
                    }}
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
