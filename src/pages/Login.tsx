import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useLoginRateLimit } from "@/hooks/useLoginRateLimit";
import {
  AuthShell,
  BauhausCard,
  BauhausField,
  BauhausButton,
  BauhausLink,
  BauhausLoader,
} from "@/components/onboarding/BauhausAuth";

export default function Login() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { isLocked, remainingSeconds, attemptsLeft, checkCanAttempt, recordFailedAttempt, resetAttempts } = useLoginRateLimit();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!authLoading && session) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, session, navigate]);

  // Only show spinner if we're actively restoring a session (user is likely logged in)
  // For anonymous users, authLoading is false from the start — no spinner needed
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  // Already logged in — redirect is pending, show nothing
  if (session) return null;

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast.error(error.message || "Google sign-in failed");
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

  const signInWithProxy = async (loginEmail: string, loginPassword: string) => {
    const { data, error } = await supabase.functions.invoke("auth-proxy", {
      body: {
        action: "login",
        email: loginEmail,
        password: loginPassword,
      },
    });

    if (error) {
      throw new Error(error.message || "Unable to connect to authentication service");
    }

    const proxyError = (data as { error?: string } | null)?.error;
    if (proxyError) {
      throw new Error(proxyError);
    }

    const sessionData = (data as { data?: { access_token?: string; refresh_token?: string } } | null)?.data;
    if (!sessionData?.access_token || !sessionData?.refresh_token) {
      throw new Error("Authentication failed. Please try again.");
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: sessionData.access_token,
      refresh_token: sessionData.refresh_token,
    });

    if (sessionError) {
      throw new Error(sessionError.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!checkCanAttempt()) {
      toast.error(`Too many login attempts. Please wait ${remainingSeconds}s.`);
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (error) {
        if (isFetchFailure(error.message)) {
          await signInWithProxy(normalizedEmail, password);
          resetAttempts();
          navigate("/dashboard");
          return;
        }

        recordFailedAttempt();
        toast.error(error.message);
        return;
      }

      resetAttempts();
      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";

      if (isFetchFailure(message)) {
        try {
          await signInWithProxy(normalizedEmail, password);
          resetAttempts();
          navigate("/dashboard");
          return;
        } catch (proxyErr) {
          recordFailedAttempt();
          const proxyMessage =
            proxyErr instanceof Error ? proxyErr.message : "Unable to sign in. Please try again.";
          toast.error(proxyMessage);
          return;
        }
      }

      recordFailedAttempt();
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Merchant Login"
      title={<>Welcome<br />Back</>}
      subtitle="Sign in to run your storefront, orders and payouts."
      panelTitle={"Your shop.\nYour rules.\nOne login."}
      panelPoints={["Orders & payouts live", "WhatsApp recovery engine", "Ads + Pixel in one view"]}
    >
      <BauhausCard corner="blue">
        <form onSubmit={handleLogin} className="space-y-5">
          <BauhausField
            id="email"
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <BauhausField
            id="password"
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            maxLength={128}
          />

          <BauhausButton
            type="submit"
            variant="red"
            className="w-full"
            loading={loading}
            disabled={loading || googleLoading || isLocked}
          >
            {isLocked ? `Locked (${remainingSeconds}s)` : "Sign in"}
          </BauhausButton>

          {attemptsLeft < 5 && !isLocked && (
            <p className="border-2 border-foreground bg-bauhaus-yellow px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-foreground">
              {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
            </p>
          )}
        </form>
      </BauhausCard>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          No account yet? <BauhausLink to="/signup">Create a store</BauhausLink>
        </p>
        <BauhausLink to="/forgot-password">Forgot password</BauhausLink>
      </div>
    </AuthShell>
  );
}
