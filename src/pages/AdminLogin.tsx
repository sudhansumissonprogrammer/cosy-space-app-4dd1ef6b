import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Shield, Loader2 } from "lucide-react";
import { useLoginRateLimit } from "@/hooks/useLoginRateLimit";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { isLocked, remainingSeconds, attemptsLeft, checkCanAttempt, recordFailedAttempt, resetAttempts } = useLoginRateLimit();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!checkCanAttempt()) {
      toast.error(`Too many login attempts. Please wait ${remainingSeconds}s.`);
      return;
    }

    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setLoading(false);
      recordFailedAttempt();
      toast.error(authError.message);
      return;
    }

    const { data: isAdmin, error: roleError } = await supabase.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      await supabase.auth.signOut({ scope: 'local' });
      setLoading(false);
      recordFailedAttempt();
      toast.error("Access denied. Admin privileges required.");
      return;
    }

    resetAttempts();
    setLoading(false);
    navigate("/admin");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-destructive">
            <Shield className="h-6 w-6 text-destructive-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Sign in with admin credentials</p>
        </div>

        <Card>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button type="submit" className="w-full" disabled={loading || isLocked}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLocked ? `Locked (${remainingSeconds}s)` : "Sign in as Admin"}
              </Button>
              {attemptsLeft < 5 && !isLocked && (
                <p className="text-center text-xs text-destructive">{attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining</p>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
