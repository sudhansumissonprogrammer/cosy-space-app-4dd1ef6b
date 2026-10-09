import { useState, useEffect, useRef } from "react";
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

/** Strip +91 / 0 prefixes → bare 10-digit subscriber number. */
const stripIndiaPrefix = (value: string): string => {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
};

const isValidMobile = (value: string) => {
  const local = stripIndiaPrefix(value);
  return local.length === 10 && /^[6-9]/.test(local);
};

export default function Signup() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // WhatsApp OTP step
  const [otpPhone, setOtpPhone] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Email-verification fallback (used only when WhatsApp is unavailable)
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [noWhatsApp, setNoWhatsApp] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [emailVerifying, setEmailVerifying] = useState(false);

  const timerRef = useRef<number | null>(null);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (!authLoading && session) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, session, navigate]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    timerRef.current = window.setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [resendIn]);

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

  const showVerificationStep = (signupEmail: string) => {
    setVerificationEmail(signupEmail);
    setOtpPhone(null);
    setEmailCode("");
    toast.success(`We emailed a 6-digit code to ${signupEmail}`);
  };

  /** Sends the WhatsApp OTP. Falls back to email verification when WA fails. */
  const sendWhatsAppOtp = async (mobile: string, signupEmail: string, silent = false) => {
    const { data, error } = await supabase.functions.invoke("merchant-otp-send", {
      body: { phone: mobile, purpose: "signup" },
    });

    const payload = data as { ok?: boolean; error?: string; message?: string; retry_after?: number } | null;

    if (error || !payload?.ok) {
      const code = payload?.error;
      if (code === "cooldown" || code === "rate_limited") {
        toast.error(payload?.message || "Please wait before requesting another code.");
        setResendIn(payload?.retry_after ?? 30);
        return true; // stay on the OTP screen
      }
      if (code === "phone_taken") {
        toast.error(payload?.message || "This mobile number already exists — please log in instead.");
        return false;
      }

      if (!silent) {
        toast.error("WhatsApp code couldn't be sent — verify by email instead.");
        showVerificationStep(signupEmail);
      }
      return false;
    }

    setOtpPhone(mobile);
    setResendIn(30);
    if (!silent) toast.success(`Code sent on WhatsApp to +91 ${mobile}`);
    return true;
  };

  /** WhatsApp code when a number was given; otherwise the emailed code. */
  const startVerification = async (mobile: string, signupEmail: string) => {
    if (!mobile) {
      showVerificationStep(signupEmail);
      return;
    }
    await sendWhatsAppOtp(mobile, signupEmail);
  };

  const handleVerifyEmailCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationEmail) return;
    const token = emailCode.replace(/\D/g, "");
    if (token.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }
    setEmailVerifying(true);
    try {
      let { data, error } = await supabase.auth.verifyOtp({ email: verificationEmail, token, type: "signup" });
      if (error) {
        const retry = await supabase.auth.verifyOtp({ email: verificationEmail, token, type: "email" });
        if (!retry.error) ({ data, error } = retry);
      }
      if (error || !data?.session) {
        toast.error("Incorrect or expired code. Please try again or resend.");
        return;
      }
      toast.success("Email verified — welcome!");
      navigate("/dashboard");
    } finally {
      setEmailVerifying(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedFullName = fullName.trim();
    const mobile = noWhatsApp ? "" : stripIndiaPrefix(phone);

    if (!normalizedEmail || !password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }
    if (!noWhatsApp && !isValidMobile(phone)) {
      toast.error("Enter a valid 10-digit WhatsApp number");
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
      // Pre-check duplicates so users get a clear message instead of a silent
      // no-op. The lookup RPCs are service-role only, so this runs server-side.
      const { data: dupe } = await supabase.functions.invoke("merchant-otp-send", {
        body: { action: "check", phone: mobile || undefined, email: normalizedEmail },
      });

      if (dupe?.email_taken) {
        toast.error("This email already exists — please use another email or log in.");
        return;
      }
      if (dupe?.phone_taken) {
        toast.error("This mobile number already exists — please use another number or log in.");
        return;
      }



      const { data: signUpData, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: { full_name: normalizedFullName || null, phone: mobile || null, user_type: "merchant" },
        },
      });

      if (error) {
        if (isFetchFailure(error.message)) {
          await signUpWithProxy(normalizedEmail, password, normalizedFullName);
          attachReferralAfterSignup().catch(() => {});
          await startVerification(mobile, normalizedEmail);
          return;
        }

        if (/already\s*(registered|exists)|duplicate/i.test(error.message)) {
          toast.error("This email already exists — please use another email or log in.");
          return;
        }

        toast.error(error.message);
        return;
      }

      // Supabase returns a user with no identities when the email is already taken
      if (signUpData?.user && Array.isArray(signUpData.user.identities) && signUpData.user.identities.length === 0) {
        toast.error("This email already exists — please use another email or log in.");
        return;
      }

      // Best-effort: attach this signup to the referring partner (if any cookie set)
      attachReferralAfterSignup().catch(() => {});


      if (signUpData?.session) {
        toast.success("Account created successfully!");
        navigate("/dashboard");
        return;
      }

      await startVerification(mobile, normalizedEmail);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to create account";

      if (isFetchFailure(message)) {
        try {
          await signUpWithProxy(normalizedEmail, password, normalizedFullName);
          attachReferralAfterSignup().catch(() => {});
          await startVerification(mobile, normalizedEmail);
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

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpPhone) return;
    if (otpCode.replace(/\D/g, "").length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("merchant-otp-verify", {
        body: {
          phone: otpPhone,
          code: otpCode.replace(/\D/g, ""),
          purpose: "signup",
          email: email.trim().toLowerCase(),
        },
      });

      const payload = data as
        | { verified?: boolean; error?: string; message?: string; session?: { access_token: string; refresh_token: string } | null }
        | null;

      if (error || !payload?.verified) {
        toast.error(payload?.message || "Incorrect or expired code. Please try again.");
        return;
      }

      if (payload.session) {
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: payload.session.access_token,
          refresh_token: payload.session.refresh_token,
        });
        if (sessErr) throw sessErr;
        toast.success("Number verified — welcome!");
        navigate("/dashboard");
        return;
      }

      toast.success("Number verified. Please sign in.");
      navigate("/login");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendVerification = async () => {
    if (!verificationEmail) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: verificationEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("A new code has been emailed.");
  };

  return (
    <AuthShell
      eyebrow={otpPhone ? "Step 02 — Verify" : "Step 01 — Account"}
      title={otpPhone ? <>Verify<br />Your Number</> : <>Build<br />Your Shop</>}
      subtitle={
        otpPhone
          ? "We sent a 6-digit code on WhatsApp. Enter it below to activate your account."
          : "Create your account first. You'll set up the store — name, logo, payments — right after."
      }
      panelTitle={"Form follows\nfunction.\nSo does sales."}
      panelPoints={["Free to start", "Storefront live in minutes", "UPI, COD & cards built in"]}
    >
      <BauhausCard corner="red">
        {otpPhone ? (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <p className="text-lg font-black text-foreground">Enter WhatsApp code</p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                Sent to <strong className="text-foreground">+91 {otpPhone}</strong>. The code expires in 5 minutes.
              </p>
            </div>

            <BauhausField
              id="otp"
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

            <BauhausButton
              type="submit"
              variant="red"
              className="w-full"
              loading={verifying}
              disabled={verifying || otpCode.length !== 6}
            >
              Verify &amp; continue
            </BauhausButton>

            <BauhausButton
              type="button"
              variant="outline"
              className="w-full"
              disabled={resendIn > 0}
              onClick={() => sendWhatsAppOtp(otpPhone, email.trim().toLowerCase(), true)}
            >
              {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code on WhatsApp"}
            </BauhausButton>

            <button
              type="button"
              className="w-full text-xs font-semibold text-muted-foreground underline underline-offset-4"
              onClick={() => {
                setOtpPhone(null);
                setOtpCode("");
              }}
            >
              Wrong number? Go back
            </button>
            <button
              type="button"
              className="w-full text-xs font-semibold text-muted-foreground underline underline-offset-4"
              onClick={() => showVerificationStep(email.trim().toLowerCase())}
            >
              No WhatsApp? Verify by email instead
            </button>
          </form>
        ) : verificationEmail ? (
          <form onSubmit={handleVerifyEmailCode} className="space-y-5">
            <div>
              <p className="text-lg font-black text-foreground">Enter email code</p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-muted-foreground">
                We sent a 6-digit code to <strong className="text-foreground">{verificationEmail}</strong>.
                Check your inbox (and spam folder). You can also tap the link in that email.
              </p>
            </div>
            <BauhausField
              id="email-otp"
              label="6-digit code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="••••••"
              maxLength={6}
              value={emailCode}
              onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="text-center text-2xl tracking-[0.5em]"
              autoFocus
            />
            <BauhausButton
              type="submit"
              variant="red"
              className="w-full"
              loading={emailVerifying}
              disabled={emailVerifying || emailCode.length !== 6}
            >
              Verify &amp; continue
            </BauhausButton>
            <BauhausButton
              type="button"
              variant="outline"
              className="w-full"
              loading={resending}
              disabled={resending}
              onClick={handleResendVerification}
            >
              Resend code by email
            </BauhausButton>
          </form>
        ) : (
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
              id="phone"
              label="WhatsApp number"
              type="tel"
              inputMode="numeric"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").slice(0, 13))}
              autoComplete="tel"
              hint={noWhatsApp ? "Optional — we'll verify you by email instead." : "We'll send a verification code here on WhatsApp."}
              disabled={noWhatsApp}
            />
            <label className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <input
                type="checkbox"
                checked={noWhatsApp}
                onChange={(e) => setNoWhatsApp(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              I don't have WhatsApp — send the code to my email
            </label>
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
        )}
      </BauhausCard>

      <p className="mt-6 text-sm font-medium text-muted-foreground">
        Already have an account? <BauhausLink to="/login">Sign in</BauhausLink>
      </p>
    </AuthShell>
  );
}
