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

/** Strip +91 / 0 prefixes → bare 10-digit subscriber number. */
const stripIndiaPrefix = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
};

export default function Login() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // WhatsApp OTP sign-in
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const { isLocked, remainingSeconds, attemptsLeft, checkCanAttempt, recordFailedAttempt, resetAttempts } = useLoginRateLimit();


  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!authLoading && session) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, session, navigate]);

  // OTP resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendIn]);


  // Only show spinner if we're actively restoring a session (user is likely logged in)
  // For anonymous users, authLoading is false from the start — no spinner needed
  if (authLoading) {
    return <BauhausLoader />;
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

  const sendOtp = async () => {
    const mobile = stripIndiaPrefix(phone);
    if (mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setOtpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("merchant-otp-send", {
        body: { phone: mobile, purpose: "login" },
      });
      const payload = data as { ok?: boolean; error?: string; message?: string; retry_after?: number } | null;

      if (error || !payload?.ok) {
        if (payload?.error === "cooldown" || payload?.error === "rate_limited") {
          setOtpSent(true);
          setResendIn(payload?.retry_after ?? 30);
        }
        toast.error(payload?.message || "Couldn't send the code. Try password sign-in.");
        return;
      }
      setOtpSent(true);
      setResendIn(30);
      toast.success(`Code sent on WhatsApp to +91 ${mobile}`);
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const mobile = stripIndiaPrefix(phone);
    if (otpCode.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setOtpLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("merchant-otp-verify", {
        body: { phone: mobile, code: otpCode, purpose: "login" },
      });
      const payload = data as
        | { verified?: boolean; message?: string; session?: { access_token: string; refresh_token: string } | null }
        | null;

      if (error || !payload?.verified) {
        toast.error(payload?.message || "Incorrect or expired code.");
        return;
      }
      if (!payload.session) {
        toast.error(payload.message || "Your code was verified, but sign-in could not finish. Please try again.");
        return;
      }

      const { error: sessErr } = await supabase.auth.setSession({
        access_token: payload.session.access_token,
        refresh_token: payload.session.refresh_token,
      });
      if (sessErr) throw sessErr;
      resetAttempts();
      navigate("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setOtpLoading(false);
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
        {mode === "otp" ? (
          <form onSubmit={verifyOtp} className="space-y-5">
            <BauhausField
              id="login-phone"
              label="WhatsApp number"
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 13))}
              autoComplete="tel"
              disabled={otpSent}
            />

            {otpSent && (
              <BauhausField
                id="login-otp"
                label="6-digit code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="••••••"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em]"
                autoFocus
              />
            )}

            {otpSent ? (
              <>
                <BauhausButton
                  type="submit"
                  variant="red"
                  className="w-full"
                  loading={otpLoading}
                  disabled={otpLoading || otpCode.length !== 6}
                >
                  Verify &amp; sign in
                </BauhausButton>
                <BauhausButton
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={resendIn > 0 || otpLoading}
                  onClick={sendOtp}
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </BauhausButton>
              </>
            ) : (
              <BauhausButton
                type="button"
                variant="red"
                className="w-full"
                loading={otpLoading}
                disabled={otpLoading}
                onClick={sendOtp}
              >
                Send WhatsApp code
              </BauhausButton>
            )}

            <button
              type="button"
              className="w-full text-xs font-semibold text-muted-foreground underline underline-offset-4"
              onClick={() => {
                setMode("password");
                setOtpSent(false);
                setOtpCode("");
              }}
            >
              Sign in with email &amp; password instead
            </button>
          </form>
        ) : (
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

            <BauhausButton
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setMode("otp")}
            >
              Sign in with WhatsApp OTP
            </BauhausButton>

            {attemptsLeft < 5 && !isLocked && (
              <p className="border-2 border-foreground bg-bauhaus-yellow px-3 py-2 text-center text-xs font-bold uppercase tracking-wider text-foreground">
                {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
              </p>
            )}
          </form>
        )}
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
