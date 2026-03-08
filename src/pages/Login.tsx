import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { LayoutDashboard, Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (error) {
        if (isFetchFailure(error.message)) {
          await signInWithProxy(normalizedEmail, password);
          navigate("/dashboard");
          return;
        }

        toast.error(error.message);
        return;
      }

      navigate("/dashboard");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Authentication failed";

      if (isFetchFailure(message)) {
        try {
          await signInWithProxy(normalizedEmail, password);
          navigate("/dashboard");
          return;
        } catch (proxyErr) {
          const proxyMessage =
            proxyErr instanceof Error ? proxyErr.message : "Unable to sign in. Please try again.";
          toast.error(proxyMessage);
          return;
        }
      }

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
          <h1 className="text-xl font-semibold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your account</p>
        </div>

        <Card>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-6">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  maxLength={128}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/signup" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
