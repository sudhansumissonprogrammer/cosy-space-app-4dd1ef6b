import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Mail } from "lucide-react";
import { useLoginRateLimit } from "@/hooks/useLoginRateLimit";
import {
  AuthShell,
  BauhausCard,
  BauhausField,
  BauhausButton,
  BauhausLink,
} from "@/components/onboarding/BauhausAuth";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { isLocked, remainingSeconds, attemptsLeft, checkCanAttempt, recordFailedAttempt, resetAttempts } = useLoginRateLimit();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    if (!checkCanAttempt()) {
      toast.error(`Too many requests. Please wait ${remainingSeconds}s.`);
      return;
    }
    setLoading(true);
    const publishedAppOrigin = "https://cosy-space-app.lovable.app";
    const hostname = window.location.hostname;
    const redirectOrigin =
      hostname.endsWith(".lovableproject.com") || hostname.startsWith("id-preview--")
        ? publishedAppOrigin
        : window.location.origin;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${redirectOrigin}/auth/callback`,
    });
    setLoading(false);
    if (error) {
      recordFailedAttempt();
      toast.error(error.message);
    } else {
      resetAttempts();
      setSent(true);
    }
  };

  return (
    <AuthShell
      eyebrow="Account recovery"
      title={<>Reset<br />Password</>}
      subtitle="Enter your email and we'll send you a secure reset link."
      panelTitle={"Locked out?\nOne link.\nBack in."}
      panelPoints={["Secure email link", "Expires automatically", "Your store stays live"]}
    >
      <BauhausCard corner="yellow">
        {sent ? (
          <div className="space-y-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bauhaus-yellow/25">
              <Mail className="h-6 w-6 text-foreground" strokeWidth={3} />
            </div>
            <p className="text-base font-medium leading-relaxed text-foreground">
              If an account exists for <strong className="font-black">{email}</strong>, a password
              reset link is on its way.
            </p>
            <Link to="/login">
              <BauhausButton variant="outline" className="w-full" type="button">
                <ArrowLeft className="h-4 w-4" strokeWidth={3} />
                Back to sign in
              </BauhausButton>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-5">
            <BauhausField
              id="email"
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
              autoComplete="email"
            />
            <BauhausButton
              type="submit"
              variant="red"
              className="w-full"
              loading={loading}
              disabled={loading || isLocked}
            >
              {isLocked ? `Locked (${remainingSeconds}s)` : "Send reset link"}
            </BauhausButton>
            {attemptsLeft < 5 && !isLocked && (
              <p className="rounded-lg bg-bauhaus-yellow/20 px-3 py-2 text-center text-xs font-semibold text-foreground">
                {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
              </p>
            )}
          </form>
        )}
      </BauhausCard>

      <p className="mt-6 text-sm font-medium text-muted-foreground">
        Remembered it? <BauhausLink to="/login">Back to sign in</BauhausLink>
      </p>
    </AuthShell>
  );
}
