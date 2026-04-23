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

  // Auto-format: keep digits only (and a single leading +), allow up to 13 chars (e.g. +919876543210)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^\d+]/g, "");
    // keep '+' only at the very start
    raw = raw.startsWith("+") ? "+" + raw.slice(1).replace(/\+/g, "") : raw.replace(/\+/g, "");
    setPhone(raw.slice(0, 13));
    if (error) setError(null);
  };

  // Strip optional +91 / 91 prefix → return the bare 10-digit subscriber number
  const stripIndiaPrefix = (value: string): string => {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
    return digits;
  };

  const validatePhone = (value: string): string | null => {
    if (!value) return "Mobile number is required";
    const local = stripIndiaPrefix(value);
    if (local.length !== 10) return "Enter a valid 10-digit mobile number";
    if (!/^[6-9]/.test(local)) return "Mobile number must start with 6, 7, 8 or 9";
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
    const normalized = stripIndiaPrefix(phone);
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
                autoComplete="tel"
                pattern="[0-9]*"
                maxLength={15}
                placeholder="10-digit mobile number"
                value={phone}
                onChange={handlePhoneChange}
                aria-invalid={!!error}
                aria-describedby={error ? "phone-error" : undefined}
                required
                autoFocus
              />
              {error && (
                <p id="phone-error" className="text-xs text-destructive">{error}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={loading || isLocked || phone.length < 10}>
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
