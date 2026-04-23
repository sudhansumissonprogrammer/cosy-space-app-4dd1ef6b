import { useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { storefrontPath } from "@/lib/subdomain";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { useLoginRateLimit } from "@/hooks/useLoginRateLimit";

export default function StorefrontLogin() {
  const store = useOutletContext<StoreData>();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const { isLocked, remainingSeconds, attemptsLeft, checkCanAttempt, recordFailedAttempt, resetAttempts } = useLoginRateLimit();

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkCanAttempt()) {
      toast.error(`Too many attempts. Please wait ${remainingSeconds}s.`);
      return;
    }
    const normalized = phone.replace(/[^0-9]/g, "");
    if (normalized.length < 7) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-login", {
        body: { phone: normalized, store_id: store.id },
      });
      if (error || !data?.session) {
        recordFailedAttempt();
        throw new Error(error?.message || data?.error || "Login failed");
      }
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
      if (sessErr) throw sessErr;
      resetAttempts();
      toast.success(data.is_new_user ? "Welcome!" : "Logged in!");
      navigate(storefrontPath(store.slug, "account"));
    } catch (err: any) {
      toast.error(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Continue with Mobile Number</CardTitle>
          <CardDescription>
            Enter your number to view your orders, addresses & track delivery. No password needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePhoneLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Number</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || isLocked}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLocked ? `Locked (${remainingSeconds}s)` : "Continue"}
            </Button>
          </form>

          {attemptsLeft < 5 && !isLocked && (
            <p className="mt-3 text-xs text-destructive text-center">
              {attemptsLeft} attempt{attemptsLeft !== 1 ? "s" : ""} remaining
            </p>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            New customers: an account is created automatically with your number.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
