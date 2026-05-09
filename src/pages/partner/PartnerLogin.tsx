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

export default function PartnerLogin() {
  const navigate = useNavigate();
  const { session, loading: authLoading, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [otherAccount, setOtherAccount] = useState<string | null>(null);

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
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      navigate("/partners/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Partner login</h1>
          <p className="text-sm text-muted-foreground">Sign in to your partner dashboard</p>
        </div>
        <Card>
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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login
              </Button>
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
