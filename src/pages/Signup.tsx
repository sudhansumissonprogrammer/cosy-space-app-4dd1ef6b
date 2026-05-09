import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { LayoutDashboard, Loader2 } from "lucide-react";
import { attachReferralAfterSignup } from "@/lib/referralTracking";

export default function Signup() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!authLoading && session) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, session, navigate]);

  if (authLoading || session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (error) {
        toast.error(error.message || "Google sign-in failed");
      } else {
        attachReferralAfterSignup().catch(() => {});
      }
    } catch (err) {
      toast.error("Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const isFetchFailure = (message: string) =>
    message.toLowerCase().includes("failed to fetch") ||
    message.toLowerCase().includes("network");

  const signUpWithProxy = async (
    signupEmail: string,
    signupPassword: string,
    signupFullName: string
  ) => {
    const { data, error } = await supabase.functions.invoke("auth-proxy", {
      body: {
        action: "signup",
        email: signupEmail,
        password: signupPassword,
        fullName: signupFullName || null,
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw new Error(error.message || "Unable to connect to authentication service");
    }

    const proxyError = (data as { error?: string } | null)?.error;
    if (proxyError) {
      throw new Error(proxyError);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();

    if (!normalizedEmail || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: normalizedFullName || null, user_type: "merchant" },
        },
      });

      if (error) {
        if (isFetchFailure(error.message)) {
          await signUpWithProxy(normalizedEmail, password, normalizedFullName);
          attachReferralAfterSignup().catch(() => {});
          toast.success("Account created! Signing you in...");
          navigate("/dashboard");
          return;
        }

        toast.error(error.message);
        return;
      }

      // Best-effort: attach this signup to the referring partner (if any cookie set)
      attachReferralAfterSignup().catch(() => {});

      if (signUpData?.session) {
        toast.success("Account created successfully!");
        navigate("/dashboard");
      } else {
        toast.success("Account created! Please check your email to confirm.");
        navigate("/login");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create account";

      if (isFetchFailure(message)) {
        try {
          await signUpWithProxy(normalizedEmail, password, normalizedFullName);
          attachReferralAfterSignup().catch(() => {});
          toast.success("Account created! Signing you in...");
          navigate("/dashboard");
          return;
        } catch (proxyErr) {
          const proxyMessage =
            proxyErr instanceof Error ? proxyErr.message : "Unable to create account. Please try again.";
          toast.error(proxyMessage);
          return;
        }
      }

      console.error("Signup network error:", err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
            <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Create an account</h1>
          <p className="text-sm text-muted-foreground">
            Get started — choose a plan when you create your store
          </p>
        </div>

        <Card>
          <form onSubmit={handleSignup}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  maxLength={100}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Account
              </Button>

              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}