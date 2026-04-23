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
  const [error, setError] = useState<string | null>(null);

  const { isLocked, remainingSeconds, attemptsLeft, checkCanAttempt, recordFailedAttempt, resetAttempts } = useLoginRateLimit();

  // Auto-format: digits only, max 15 (E.164 max)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 15);
    setPhone(digits);
    if (error) setError(null);
  };

  const validatePhone = (value: string): string | null => {
    if (!value) return "Mobile number is required";
    if (value.length < 10) return `Enter at least 10 digits (${value.length}/10)`;
    if (value.length > 15) return "Number is too long";
    return null;
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validatePhone(phone);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!checkCanAttempt()) {
      toast.error(`Too many attempts. Please wait ${remainingSeconds}s.`);
      return;
    }
    const normalized = phone;
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
