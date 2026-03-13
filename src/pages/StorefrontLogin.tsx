import { useState } from "react";
import { Link, useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useStorefrontAuth } from "@/contexts/StorefrontAuthContext";
import { storefrontPath } from "@/lib/subdomain";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { useLoginRateLimit } from "@/hooks/useLoginRateLimit";

export default function StorefrontLogin() {
  const store = useOutletContext<StoreData>();
  const { signIn } = useStorefrontAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { isLocked, remainingSeconds, attemptsLeft, checkCanAttempt, recordFailedAttempt, resetAttempts } = useLoginRateLimit();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!checkCanAttempt()) {
      toast.error(`Too many login attempts. Please wait ${remainingSeconds}s.`);
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      recordFailedAttempt();
      toast.error(error.message || "Login failed");
    } else {
      resetAttempts();
      toast.success("Logged in!");
      navigate(storefrontPath(store.slug, "account"));
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>Sign in to your {store.name} account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading || isLocked}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLocked ? `Locked (${remainingSeconds}s)` : "Sign In"}
            </Button>
            {attemptsLeft < 5 && !isLocked && (
              <p className="text-xs text-destructive text-center">{attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining</p>
            )}
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to={storefrontPath(store.slug, "signup")} className="font-medium text-primary underline">
              Sign Up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
