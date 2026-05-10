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

export default function PartnerSignup() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !session) return;
    (async () => {
      const { data } = await supabase.from("partners").select("id").eq("user_id", session.user.id).maybeSingle();
      if (data) {
        navigate("/partners/dashboard", { replace: true });
        return;
      }
      // Auth user exists but partner row missing (e.g. email-verify interrupted signup).
      // Auto-create from auth metadata so they don't get stuck in a redirect loop.
      const meta = (session.user.user_metadata || {}) as any;
      if (meta.user_type === "partner" || meta.full_name) {
        const { error } = await supabase.from("partners").insert({
          user_id: session.user.id,
          name: meta.full_name || session.user.email?.split("@")[0] || "Partner",
          email: session.user.email!,
          mobile: meta.mobile || null,
        });
        if (!error) {
          toast.success("Welcome aboard! Your partner account is ready.");
          navigate("/partners/dashboard", { replace: true });
        }
      }
    })();
  }, [authLoading, session, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = { name: name.trim(), email: email.trim().toLowerCase(), mobile: mobile.trim() };
    if (!trimmed.name || !trimmed.email || !password) {
      toast.error("Please fill all required fields");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      let userId: string | null = session?.user.id ?? null;

      if (!userId) {
        const { data, error } = await supabase.auth.signUp({
          email: trimmed.email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/partners/dashboard`,
            data: { full_name: trimmed.name, mobile: trimmed.mobile, user_type: "partner" },
          },
        });
        if (error) throw error;
        userId = data.user?.id ?? null;
        if (!data.session) {
          // Email confirmation required path
          toast.success("Account created! Please check your email, then sign in.");
          navigate("/partners/login");
          return;
        }
      }

      if (!userId) throw new Error("Signup failed");

      const { error: insErr } = await supabase.from("partners").insert({
        user_id: userId,
        name: trimmed.name,
        email: trimmed.email,
        mobile: trimmed.mobile || null,
      });
      if (insErr && !String(insErr.message).toLowerCase().includes("duplicate")) {
        throw insErr;
      }

      toast.success("Welcome aboard! Your partner account is ready.");
      navigate("/partners/dashboard");
    } catch (err: any) {
      toast.error(err?.message || "Could not create partner account");
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Join the Partner Program</h1>
          <p className="text-center text-sm text-muted-foreground">
            Earn recurring commission on every store you refer
          </p>
        </div>
        <Card className="rounded-2xl border shadow-xl shadow-primary/5">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile (optional)</Label>
                <Input id="mobile" type="tel" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={20} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create partner account
              </Button>
              <p className="text-sm text-muted-foreground">
                Already a partner?{" "}
                <Link to="/partners/login" className="font-medium text-primary hover:underline">Login</Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
