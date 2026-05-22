/**
 * Meta CAPI Setup Wizard
 * ------------------------------------------------------------------
 * 4-step guided flow that walks merchants through generating a Meta
 * System User access token and pasting it. Includes a live "Test
 * Connection" button that fires a TestEvent against the Graph API
 * via the verify-meta-capi edge function.
 *
 * Replaces the bare "paste your token" input. Designed to massively
 * lift CAPI adoption (currently ~5%) — which is the single biggest
 * lever to reduce ad-account bans on the platform.
 */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Loader2,
  Server,
  Sparkles,
  ChevronRight,
} from "lucide-react";

interface Props {
  pixelId: string;
  accessToken: string;
  onAccessTokenChange: (v: string) => void;
}

type VerifyState =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "ok"; events: number; fbtrace?: string }
  | { kind: "error"; message: string; fbtrace?: string };

export function MetaCapiSetupWizard({ pixelId, accessToken, onAccessTokenChange }: Props) {
  const [verify, setVerify] = useState<VerifyState>({ kind: "idle" });

  const canTest = !!pixelId && accessToken.length >= 30;

  async function runTest() {
    if (!canTest) return;
    setVerify({ kind: "running" });
    try {
      const { data, error } = await supabase.functions.invoke("verify-meta-capi", {
        body: { pixel_id: pixelId.trim(), access_token: accessToken.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.ok) {
        setVerify({
          kind: "ok",
          events: data.events_received ?? 1,
          fbtrace: data.fbtrace_id,
        });
      } else {
        setVerify({
          kind: "error",
          message: data?.error || "Verification failed",
          fbtrace: data?.fbtrace_id,
        });
      }
    } catch (e: any) {
      setVerify({ kind: "error", message: e?.message || "Network error" });
    }
  }

  return (
    <Card className="border-emerald-200 dark:border-emerald-900">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="h-5 w-5 text-emerald-600" />
          Conversions API (CAPI) Setup
          <span className="ml-auto rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Recommended
          </span>
        </CardTitle>
        <CardDescription>
          Server-side tracking — bypasses iOS / ad-blockers, lifts EMQ to 8/10 and
          protects your ad account from "low signal quality" bans.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Steps */}
        <ol className="space-y-3">
          <StepRow
            n={1}
            title="Open Meta Events Manager"
            done={!!pixelId}
            body={
              <>
                Go to your Pixel's settings page in Events Manager.
                <a
                  href={
                    pixelId
                      ? `https://business.facebook.com/events_manager2/list/pixel/${pixelId}/settings`
                      : "https://business.facebook.com/events_manager2"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open Events Manager <ExternalLink className="h-3 w-3" />
                </a>
              </>
            }
          />
          <StepRow
            n={2}
            title="Generate Access Token"
            done={accessToken.length > 0}
            body={
              <>
                Scroll to <b>Conversions API → Set up manually → Generate access
                token</b>. Copy the long string that appears (starts with
                <code className="mx-1 rounded bg-muted px-1 text-xs">EAA…</code>).
              </>
            }
          />
          <StepRow
            n={3}
            title="Paste it below"
            done={accessToken.length >= 30}
            body={
              <div className="space-y-2 pt-1">
                <Label htmlFor="meta-token" className="sr-only">
                  Access Token
                </Label>
                <Input
                  id="meta-token"
                  type="password"
                  placeholder="EAAxxxxxxxxxxxxxxxxxxxxxxxx..."
                  value={accessToken}
                  onChange={(e) => {
                    onAccessTokenChange(e.target.value);
                    setVerify({ kind: "idle" });
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-[11px] text-muted-foreground">
                  Stored encrypted. Only used server-side from your store's edge function.
                </p>
              </div>
            }
          />
          <StepRow
            n={4}
            title="Test the connection"
            done={verify.kind === "ok"}
            body={
              <div className="space-y-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canTest || verify.kind === "running"}
                  onClick={runTest}
                >
                  {verify.kind === "running" ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Sending test event…
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-3.5 w-3.5" />
                      Send Test Event to Meta
                    </>
                  )}
                </Button>

                {verify.kind === "ok" && (
                  <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    <div className="text-xs text-emerald-700 dark:text-emerald-300">
                      <p className="font-medium">
                        Meta accepted the test event ({verify.events} received).
                      </p>
                      <p>
                        Save below to activate. Use <b>Test Events</b> tab in Events
                        Manager with code <code>TEST12345</code> to see it live.
                      </p>
                    </div>
                  </div>
                )}

                {verify.kind === "error" && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-900 dark:bg-amber-950/30">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      <p className="font-medium">Test failed</p>
                      <p>{verify.message}</p>
                      {verify.fbtrace && (
                        <p className="mt-1 text-[10px] opacity-70">
                          fbtrace: {verify.fbtrace}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            }
          />
        </ol>

        {/* Help footer */}
        <div className="rounded-lg border bg-muted/40 p-3 text-[11px] text-muted-foreground">
          <p className="font-medium text-foreground">Why this matters</p>
          <p className="mt-1">
            Without CAPI, ~40% of purchases are invisible to Meta (iOS 14.5+,
            ad-blockers, browser cookies cleared). Meta's algorithm flags
            "incomplete funnels" as suspicious. Enabling CAPI is the single
            biggest protection against ad-account bans.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StepRow({
  n,
  title,
  body,
  done,
}: {
  n: number;
  title: string;
  body: React.ReactNode;
  done: boolean;
}) {
  return (
    <li className="flex gap-3">
      <div
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
      </div>
      <div className="flex-1 space-y-0.5">
        <div className="flex items-center gap-1 text-sm font-medium text-foreground">
          {title}
          {!done && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        </div>
        <div className="text-xs text-muted-foreground">{body}</div>
      </div>
    </li>
  );
}

export default MetaCapiSetupWizard;
