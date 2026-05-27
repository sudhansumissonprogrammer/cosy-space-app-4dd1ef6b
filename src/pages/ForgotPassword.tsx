import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { LayoutDashboard, Loader2, ArrowLeft, Mail } from "lucide-react";
import { useLoginRateLimit } from "@/hooks/useLoginRateLimit";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary">
            <LayoutDashboard className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Reset Password</h1>
          <p className="text-sm text-muted-foreground">Enter your email to receive a reset link</p>
        </div>

        <Card>
          {sent ? (
            <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
              <Mail className="h-10 w-10 text-primary" />
              <p className="text-sm text-muted-foreground">
                If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link to="/login">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Sign in
                </Link>
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleReset}>
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    autoComplete="email"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Reset Link
                </Button>
                <Link to="/login" className="text-sm text-muted-foreground hover:text-primary">
                  <ArrowLeft className="mr-1 inline h-3 w-3" />
                  Back to Sign in
                </Link>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
