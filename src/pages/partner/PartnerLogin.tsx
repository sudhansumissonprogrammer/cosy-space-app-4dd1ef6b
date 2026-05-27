import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { useLoginRateLimit } from "@/hooks/useLoginRateLimit";

export default function PartnerLogin() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otherAccount, setOtherAccount] = useState<string | null>(null);
  const { isLocked, remainingSeconds, attemptsLeft, checkCanAttempt, recordFailedAttempt, resetAttempts } = useLoginRateLimit();


  useEffect(() => {
    if (authLoading || !session) return;
    // If signed in, check whether this user is already a partner.
    // If yes → straight to dashboard. If no → warn instead of silently
    // overwriting their store-owner session.
    (async () => {
      const { data: p } = await supabase
        .from("partners")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (p) navigate("/partners/dashboard", { replace: true });
      else setOtherAccount(session.user.email || "another account");
    })();
  }, [authLoading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otherAccount) {
      toast.error("Sign out first to log into a partner account");
      return;
    }
    if (!checkCanAttempt()) {
      toast.error(`Too many login attempts. Please wait ${remainingSeconds}s.`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        recordFailedAttempt();
        throw error;
      }
      resetAttempts();
      navigate("/partners/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background px-4 py-10 font-dashboard">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-64 w-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="relative w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/30">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Partner login</h1>
          <p className="text-sm text-muted-foreground">Sign in to your partner dashboard</p>
        </div>
        {otherAccount && (
          <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            You're signed in as <span className="font-medium">{otherAccount}</span>. Sign out first to log into a partner account.
            <Button size="sm" variant="outline" className="mt-2 w-full" onClick={async () => { await signOut(); setOtherAccount(null); }}>
              Sign out
            </Button>
          </div>
        )}
        <Card className="rounded-2xl border shadow-xl shadow-primary/5">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <Link to="/forgot-password" className="block text-right text-xs text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || isLocked}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLocked ? `Locked (${remainingSeconds}s)` : "Login"}
              </Button>
              {attemptsLeft < 5 && !isLocked && (
                <p className="text-center text-xs text-destructive">{attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining</p>
              )}

              <p className="text-sm text-muted-foreground">
                New here?{" "}
                <Link to="/partners/signup" className="font-medium text-primary hover:underline">
                  Become a partner
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
