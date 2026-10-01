import { useMemo, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Copy, Download, Gauge, ServerCrash, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { CAPACITY_PROFILES, CapacityProfileId, profileTotals, validateCapacityTarget } from "@/config/capacityTest";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes} min ${remainder} sec` : `${minutes} min`;
}

export default function AdminTestWebsite() {
  useDocumentTitle("Website Capacity Test · Admin");
  const [targetUrl, setTargetUrl] = useState("https://");
  const [profileId, setProfileId] = useState<CapacityProfileId>("ramp");

  const profile = CAPACITY_PROFILES[profileId];
  const totals = useMemo(() => profileTotals(profile), [profile]);
  const validation = useMemo(() => validateCapacityTarget(targetUrl, profileId), [targetUrl, profileId]);
  const command = validation.valid
    ? `python loadtest/python-serdiya-capacity.py --base-url ${JSON.stringify(validation.normalizedUrl)} --profile ${profileId} --target-env ${profile.productionSafe ? "production" : "staging"} --output /tmp/website-capacity-${profileId}`
    : "";

  const copyCommand = async () => {
    if (!command) return;
    await navigator.clipboard.writeText(command);
    toast.success("Python command copied");
  };

  const downloadConfig = () => {
    if (!validation.valid) return;
    const payload = {
      target: validation.normalizedUrl,
      profile: profile.id,
      environment: profile.productionSafe ? "production" : "staging",
      stages: profile.stages,
      estimated_total_requests: totals.totalRequests,
      estimated_duration_seconds: totals.durationSeconds,
      stop_rules: ["error rate > 1%", "p95 latency > 3x baseline", "3 consecutive 5xx responses", "10 second request timeout"],
      command,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `capacity-test-${profile.id}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Admin only</Badge>
            <Badge variant={profile.productionSafe ? "secondary" : "destructive"}>{profile.productionSafe ? "Live-safe" : "Staging only"}</Badge>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Website capacity test</h1>
          <p className="mt-1 text-sm text-muted-foreground">Plan traffic precisely, then run the guarded Python tester from a controlled machine.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="space-y-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Test setup</CardTitle>
              <CardDescription>Use a staging copy for ramp, spike, and soak testing.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="capacity-target">Website address</Label>
                <Input
                  id="capacity-target"
                  type="url"
                  inputMode="url"
                  value={targetUrl}
                  onChange={(event) => setTargetUrl(event.target.value)}
                  placeholder="https://staging.example.com"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className={`text-xs ${validation.valid ? "text-success" : "text-muted-foreground"}`}>{validation.message}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="capacity-profile">Test mode</Label>
                <Select value={profileId} onValueChange={(value) => setProfileId(value as CapacityProfileId)}>
                  <SelectTrigger id="capacity-profile"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.values(CAPACITY_PROFILES).map((item) => (
                      <SelectItem key={item.id} value={item.id}>{item.label} · {item.productionSafe ? "live-safe" : "staging"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{profile.description}</p>
              </div>

              <div className="overflow-hidden rounded-lg border">
                <div className="grid grid-cols-[44px_1fr_1fr_1fr] gap-2 border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
                  <span>Step</span><span>Visitors</span><span>Req/sec</span><span>Time</span>
                </div>
                {profile.stages.map((stage, index) => (
                  <div key={`${profile.id}-${index}`} className="grid grid-cols-[44px_1fr_1fr_1fr] gap-2 border-b px-3 py-3 text-sm last:border-b-0">
                    <span className="font-semibold">{index + 1}</span>
                    <span>{stage.users}</span>
                    <span>{stage.requestsPerSecond}</span>
                    <span>{formatDuration(stage.durationSeconds)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="text-base">Run from your testing machine</CardTitle>
              <CardDescription>The browser does not send load. The Python runner keeps the safety lock active.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="min-h-20 overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-5 text-foreground">
                {command || "Enter an approved target to generate the command."}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={copyCommand} disabled={!command} className="gap-2"><Copy className="h-4 w-4" /> Copy command</Button>
                <Button onClick={downloadConfig} disabled={!validation.valid} variant="outline" className="gap-2"><Download className="h-4 w-4" /> Download configuration</Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Total requests", value: totals.totalRequests.toLocaleString(), icon: Activity },
              { label: "Run time", value: formatDuration(totals.durationSeconds), icon: Clock3 },
              { label: "Peak visitors", value: totals.peakUsers.toLocaleString(), icon: Users },
              { label: "Peak req/sec", value: totals.peakRequestsPerSecond.toLocaleString(), icon: Gauge },
            ].map(({ label, value, icon: Icon }) => (
              <Card key={label} className="shadow-none">
                <CardContent className="p-4">
                  <Icon className="mb-3 h-4 w-4 text-muted-foreground" />
                  <p className="break-words text-xl font-bold text-foreground">{value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Alert variant={profile.productionSafe ? "default" : "destructive"}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{profile.productionSafe ? "Read-only live limit" : "Staging required"}</AlertTitle>
            <AlertDescription>
              {profile.productionSafe
                ? "Only public catalog pages are read. Checkout, accounts, payments, orders, and write actions are excluded."
                : "This mode can expose the failure point. Real orders, payments, messages, pixels, and customer data must be disabled."}
            </AlertDescription>
          </Alert>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><ServerCrash className="h-4 w-4" /> Automatic stop rules</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {["Error rate exceeds 1%", "p95 response time exceeds 3× baseline", "Three consecutive server errors", "Any request exceeds the 10-second timeout"].map((rule) => (
                  <li key={rule} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /><span>{rule}</span></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}