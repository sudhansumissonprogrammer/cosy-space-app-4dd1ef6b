import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { attachReferralAfterSignup } from "@/lib/referralTracking";
import {
  AuthShell,
  BauhausCard,
  BauhausField,
  BauhausButton,
  BauhausLink,
  BauhausLoader,
} from "@/components/onboarding/BauhausAuth";

// Merchant (store-owner) registrations are open.
// This does NOT affect storefront customer accounts, checkout or orders.
const MERCHANT_SIGNUPS_ENABLED = true;

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
    return <BauhausLoader />;
  }

  if (!MERCHANT_SIGNUPS_ENABLED) {
    return (
      <AuthShell
        eyebrow="Registrations paused"
        title={<>Doors<br />Closed</>}
        subtitle="New store signups are temporarily paused. Existing stores and their customers are unaffected."
      >
        <BauhausCard corner="yellow">
          <p className="text-sm font-medium text-muted-foreground">
            Already have an account? <BauhausLink to="/login">Sign in</BauhausLink>
          </p>
          <BauhausButton variant="outline" className="mt-5 w-full" onClick={() => navigate("/")}>
            Back to home
          </BauhausButton>
        </BauhausCard>
      </AuthShell>
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
    <AuthShell
      eyebrow="Step 01 — Account"
      title={<>Build<br />Your Shop</>}
      subtitle="Create your account first. You'll set up the store — name, logo, payments — right after."
      panelTitle={"Form follows\nfunction.\nSo does sales."}
      panelPoints={["Free to start", "Storefront live in minutes", "UPI, COD & cards built in"]}
    >
      <BauhausCard corner="red">
        <form onSubmit={handleSignup} className="space-y-5">
          <BauhausField
            id="full-name"
            label="Full name"
            type="text"
            placeholder="John Doe"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            maxLength={100}
          />
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
            autoComplete="new-password"
            hint="Minimum 6 characters."
          />
          <BauhausField
            id="confirm-password"
            label="Confirm password"
            type="password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />

          <BauhausButton
            type="submit"
            variant="red"
            className="w-full"
            loading={loading}
            disabled={loading || googleLoading}
          >
            Create account
          </BauhausButton>

          <p className="text-xs font-medium leading-relaxed text-muted-foreground">
            By creating an account you agree to our{" "}
            <Link to="/terms" className="underline decoration-2 underline-offset-2 hover:text-foreground">
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="underline decoration-2 underline-offset-2 hover:text-foreground">
              Privacy Policy
            </Link>
            .
          </p>
        </form>
      </BauhausCard>

      <p className="mt-6 text-sm font-medium text-muted-foreground">
        Already have an account? <BauhausLink to="/login">Sign in</BauhausLink>
      </p>
    </AuthShell>
  );
}