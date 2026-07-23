import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AppConfigShellProps {
  /** Store slug for the back-link to /apps */
  storeSlug?: string;
  /** App icon (Lucide component or any ReactNode) */
  icon: ReactNode;
  /** Gradient tailwind classes, e.g. "from-indigo-500 to-fuchsia-500" */
  accent: string;
  title: string;
  subtitle?: string;
  /** Enable toggle (optional — not every app has one) */
  enabled?: boolean;
  onEnabledChange?: (v: boolean) => void;
  /** Save handler and state (optional — some pages have no save) */
  onSave?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  /** Additional slot beside title on desktop (e.g. "Live" badge) */
  statusBadge?: ReactNode;
  /** Right-side header actions on desktop */
  headerActions?: ReactNode;
  children: ReactNode;
}

export function AppConfigShell({
  storeSlug,
  icon,
  accent,
  title,
  subtitle,
  enabled,
  onEnabledChange,
  onSave,
  saving,
  saveDisabled,
  saveLabel = "Save",
  statusBadge,
  headerActions,
  children,
}: AppConfigShellProps) {
  const hasEnableToggle = typeof enabled === "boolean" && !!onEnabledChange;
  const hasSave = !!onSave;

  return (
    <div className="pb-32 md:pb-6">
      {/* Sticky app header */}
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5 md:px-6 md:py-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9 shrink-0 -ml-2">
            <Link to={storeSlug ? `/dashboard/stores/${storeSlug}/apps` : "/dashboard"} aria-label="Back to App Store">
              <ArrowLeft className="h-4.5 w-4.5" />
            </Link>
          </Button>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
              accent
            )}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-[15px] font-bold tracking-tight md:text-base">{title}</h1>
              {statusBadge}
            </div>
            {subtitle && (
              <p className="hidden truncate text-[11px] text-muted-foreground md:block">{subtitle}</p>
            )}
          </div>
          {/* Desktop-only header actions (Enable + Save) */}
          <div className="hidden items-center gap-2 md:flex">
            {hasEnableToggle && (
              <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
                <Label htmlFor="app-enabled" className="cursor-pointer text-xs font-semibold">
                  {enabled ? "Enabled" : "Disabled"}
                </Label>
                <Switch id="app-enabled" checked={enabled} onCheckedChange={onEnabledChange} />
              </div>
            )}
            {headerActions}
            {hasSave && (
              <Button onClick={onSave} disabled={saving || saveDisabled} className="gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saveLabel}
              </Button>
            )}
          </div>
        </div>
        {/* Mobile-only sub-row for Enable toggle */}
        {hasEnableToggle && (
          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 md:hidden">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold">{enabled ? "Live on storefront" : "Not showing to shoppers"}</p>
              {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
            </div>
            <Switch checked={enabled} onCheckedChange={onEnabledChange} />
          </div>
        )}
      </div>

      {/* Scrollable body */}
      <div className="mx-auto max-w-5xl space-y-3 px-0 pt-3 md:space-y-4 md:pt-5">
        {children}
      </div>

      {/* Sticky mobile save bar */}
      {hasSave && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.04)] backdrop-blur md:hidden">
          <Button
            onClick={onSave}
            disabled={saving || saveDisabled}
            className="h-11 w-full gap-2 text-[15px] font-semibold"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saveLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Consistent section wrapper card. Use inside <AppConfigShell>.
 */
export function AppSectionCard({
  title,
  description,
  icon,
  action,
  children,
  className,
  padded = true,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-none border-y bg-card md:rounded-2xl md:border md:shadow-sm",
        className
      )}
    >
      {(title || description || action) && (
        <header className="flex items-start justify-between gap-3 px-4 pt-4 pb-2 md:px-5 md:pt-5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {icon && <span className="text-muted-foreground">{icon}</span>}
              {title && (
                <h2 className="text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
              )}
            </div>
            {description && (
              <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      <div className={cn(padded ? "px-4 pb-4 pt-2 md:px-5 md:pb-5" : "")}>{children}</div>
    </section>
  );
}

/**
 * Live/Disabled badge helper — used in shell headers.
 */
export function AppLiveBadge({ enabled }: { enabled: boolean }) {
  return enabled ? (
    <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] px-1.5 py-0 h-4">
      Live
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
      Off
    </Badge>
  );
}
